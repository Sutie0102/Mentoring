import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL, callStructured, isAiEnabled } from "./ai/client";
import { EXTRACT_SYSTEM, VERIFY_SYSTEM } from "./ai/prompts";
import { ExtractionSchema, VerificationSchema, type Extraction } from "./ai/schemas";
import { LIMITS, STUDY_TYPE_META } from "./constants";
import { htmlToParagraphs } from "./extract/html";
import { extractPdfText } from "./extract/pdf";
import { buildEnglishQuery, detectRiskPhrases, looksMedical, splitSentences } from "./rules";
import { safeFetchText } from "./security/ssrf";
import { searchClinicalTrials } from "./sources/clinicaltrials";
import { searchOfficialSources } from "./sources/official";
import { searchPubmed } from "./sources/pubmed";
import { analysisConfidence, claimConfidence, computeRatio, computeRisk, enforceEvidenceRules } from "./stats";
import type {
  AnalysisResult,
  AnalyzePayload,
  ClaimOrigin,
  ClaimResult,
  HarmLevel,
  MediaRef,
  ProgressEvent,
  Source,
} from "./types";

export interface UploadedFile {
  name: string;
  mime: string;
  bytes: Uint8Array;
}

interface Segment {
  id: string;
  text: string;
  origin: ClaimOrigin;
}

interface ModelMedia {
  label: string;
  kind: "image" | "pdf";
  mime: string;
  base64: string;
}

type Emit = (e: ProgressEvent) => void;

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function newId(): string {
  return `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ────────────────────────── 1단계: 입력 수집 ────────────────────────── */

/** PDF처럼 줄바꿈이 문장 중간에 들어간 텍스트를 문장 단위 묶음(최대 약 500자)으로 나눈다 */
export function chunkText(text: string, max = 500): string[] {
  const flat = text.replace(/\r/g, "").replace(/\n{2,}/g, "\u0000").replace(/\s*\n\s*/g, " ");
  const out: string[] = [];
  for (const para of flat.split("\u0000")) {
    const sentences = para.split(/(?<=[.!?。]|다\.)\s+/).map((s) => s.trim()).filter(Boolean);
    let buf = "";
    for (const s of sentences) {
      if (buf && buf.length + s.length > max) {
        out.push(buf);
        buf = "";
      }
      buf = buf ? `${buf} ${s}` : s;
    }
    if (buf.trim().length > 5) out.push(buf.trim());
  }
  return out;
}

async function collect(payload: AnalyzePayload, files: Map<string, UploadedFile>, emit: Emit) {
  const segments: Segment[] = [];
  const modelMedia: ModelMedia[] = [];
  const media: MediaRef[] = [];
  const warnings: string[] = [];
  let mediaIndex = 0;

  // 텍스트
  const paragraphs = payload.text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  paragraphs.forEach((p, i) => segments.push({ id: `T${i + 1}`, text: p, origin: { kind: "text", label: "입력 텍스트" } }));

  // URL
  if (payload.url) {
    emit({ type: "log", message: "URL 본문을 가져오는 중…" });
    try {
      const page = await safeFetchText(payload.url);
      const { title, description, paragraphs: paras } = htmlToParagraphs(page.body);
      const host = new URL(page.finalUrl).hostname;
      const lines = [title, description, ...paras].filter(Boolean);
      let total = 0;
      lines.forEach((l, i) => {
        if (total > 12000) return;
        total += l.length;
        segments.push({ id: `U${i + 1}`, text: l, origin: { kind: "url", label: `웹페이지 (${host})` } });
      });
      if (lines.length === 0) warnings.push("URL에서 본문 텍스트를 찾지 못했습니다. 스크립트로 렌더링되는 페이지일 수 있습니다.");
    } catch (e) {
      warnings.push(`URL 분석 실패: ${(e as Error).message}`);
    }
  }

  // PDF
  for (const [pi, pdfMeta] of payload.pdfFields.entries()) {
    const file = files.get(pdfMeta.fileField);
    if (!file) continue;
    const idx = mediaIndex++;
    media.push({ index: idx, kind: "pdf", name: pdfMeta.name });
    try {
      const { pages, text } = await extractPdfText(file.bytes);
      if (text.length > 20) {
        const chunks = chunkText(text);
        let total = 0;
        chunks.forEach((c, i) => {
          if (total > 15000) return;
          total += c.length;
          segments.push({ id: `P${pi + 1}-${i + 1}`, text: c, origin: { kind: "pdf", label: `PDF · ${pdfMeta.name}`, fileName: pdfMeta.name, mediaIndex: idx } });
        });
        if (total > 15000) warnings.push(`PDF '${pdfMeta.name}'(${pages}쪽)가 길어 앞부분 약 15,000자만 분석했습니다.`);
      } else if (isAiEnabled()) {
        modelMedia.push({ label: `P${pi + 1}`, kind: "pdf", mime: "application/pdf", base64: Buffer.from(file.bytes).toString("base64") });
        warnings.push(`PDF '${pdfMeta.name}'에 텍스트 레이어가 없어 AI 문서 판독으로 분석했습니다.`);
      } else {
        warnings.push(`PDF '${pdfMeta.name}'에서 텍스트를 추출하지 못했습니다 (스캔본일 수 있음). 데모 모드에서는 판독할 수 없습니다.`);
      }
    } catch {
      warnings.push(`PDF '${pdfMeta.name}'를 읽지 못했습니다.`);
    }
  }

  // 이미지 (OCR은 브라우저에서 수행되어 좌표와 함께 전달됨)
  payload.images.forEach((img, ii) => {
    const idx = mediaIndex++;
    media.push({ index: idx, kind: "image", name: img.name, width: img.width, height: img.height });
    img.ocrLines
      .filter((l) => l.text.trim().length >= 2 && l.confidence >= 35)
      .forEach((l, li) =>
        segments.push({
          id: `I${ii + 1}-L${li + 1}`,
          text: l.text.trim(),
          origin: { kind: "image", label: `이미지 '${img.name}' OCR`, fileName: img.name, bbox: l.bbox, imageWidth: img.width, imageHeight: img.height, mediaIndex: idx },
        }),
      );
    const file = img.fileField ? files.get(img.fileField) : undefined;
    if (file && isAiEnabled()) modelMedia.push({ label: `I${ii + 1}`, kind: "image", mime: file.mime, base64: Buffer.from(file.bytes).toString("base64") });
    if (img.ocrLines.length === 0) warnings.push(`이미지 '${img.name}'에서 OCR 문구를 찾지 못했습니다.`);
  });

  // 영상 (프레임 추출·OCR은 브라우저, 음성 전사는 선택적 서버 처리)
  payload.videos.forEach((v, vi) => {
    const idx = mediaIndex++;
    media.push({ index: idx, kind: "video", name: v.name, width: v.width, height: v.height, duration: v.duration });
    (v.transcript ?? []).forEach((seg, si) =>
      segments.push({
        id: `V${vi + 1}-A${si + 1}`,
        text: seg.text.trim(),
        origin: { kind: "video", label: `영상 음성 ${fmtTime(seg.start)}`, fileName: v.name, timestamp: seg.start, mediaIndex: idx },
      }),
    );
    if (!v.transcript) warnings.push("영상 음성 전사가 수행되지 않아 화면에 나온 문구만 분석했습니다.");
    v.frames.forEach((f, fi) => {
      f.ocrLines
        .filter((l) => l.text.trim().length >= 2 && l.confidence >= 40)
        .forEach((l, li) =>
          segments.push({
            id: `V${vi + 1}-F${fi + 1}-L${li + 1}`,
            text: l.text.trim(),
            origin: { kind: "video", label: `영상 화면 ${fmtTime(f.time)}`, fileName: v.name, timestamp: f.time, bbox: l.bbox, imageWidth: v.width, imageHeight: v.height, mediaIndex: idx },
          }),
        );
      const file = f.fileField ? files.get(f.fileField) : undefined;
      if (file && isAiEnabled()) modelMedia.push({ label: `V${vi + 1}-F${fi + 1} (${fmtTime(f.time)})`, kind: "image", mime: file.mime, base64: Buffer.from(file.bytes).toString("base64") });
    });
  });

  return { segments, modelMedia, media, warnings };
}

/* ────────────────────────── 2단계: 주장 추출 ────────────────────────── */

interface DraftClaim {
  id: string;
  originalText: string;
  summary: string;
  entities: ClaimResult["entities"];
  riskPhrases: string[];
  pubmedQuery: string;
  trialsQuery: string;
  origin: ClaimOrigin | null;
}

function resolveOrigin(segmentId: string, originalText: string, segments: Segment[]): ClaimOrigin | null {
  const exact = segments.find((s) => s.id === segmentId);
  if (exact) return exact.origin;
  const needle = originalText.replace(/\s+/g, "").slice(0, 20);
  const fuzzy = needle && segments.find((s) => s.text.replace(/\s+/g, "").includes(needle));
  if (fuzzy) return fuzzy.origin;
  const media = /^([IV])(\d+)/.exec(segmentId);
  if (media) {
    const prefix = `${media[1]}${media[2]}`;
    const any = segments.find((s) => s.id.startsWith(prefix));
    if (any) return { ...any.origin, bbox: undefined, label: any.origin.label.replace(/ OCR$/, " (시각 요소)") };
  }
  return null;
}

function mergeRiskPhrases(text: string, fromModel: string[]): string[] {
  const rule = detectRiskPhrases(text).map((h) => h.match);
  const all = [...new Set([...fromModel, ...rule].map((s) => s.trim()).filter(Boolean))];
  // 더 긴 표현에 포함된 짧은 표현은 제거 ('완치' ⊂ '100% 완치'). 원문 전체를 통째로 넣은 경우도 제외
  return all.filter((p) => p !== text.trim() && !all.some((q) => q !== p && q.includes(p) && q !== text.trim())).slice(0, 6);
}

async function extractWithAi(segments: Segment[], modelMedia: ModelMedia[]): Promise<{ drafts: DraftClaim[]; visualNotes: string; isHealth: boolean }> {
  const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [];
  for (const m of modelMedia) {
    content.push({ type: "text", text: `[${m.label}] 첨부 ${m.kind === "pdf" ? "문서" : "이미지"}` });
    if (m.kind === "pdf") content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: m.base64 } });
    else content.push({ type: "image", source: { type: "base64", media_type: m.mime as "image/jpeg" | "image/png" | "image/webp", data: m.base64 } });
  }
  const segText = segments.map((s) => `[${s.id}] (${s.origin.label}) ${s.text}`).join("\n");
  content.push({ type: "text", text: `<ad_content>\n${segText || "(텍스트 구간 없음 — 첨부 미디어만 분석)"}\n</ad_content>\n\n위 광고에서 검증할 의학적 주장을 추출하세요.` });

  const out: Extraction = await callStructured({ system: EXTRACT_SYSTEM, content, schema: ExtractionSchema, effort: "medium" });
  const drafts = out.claims.slice(0, LIMITS.maxClaims).map((c, i) => ({
    id: `C${i + 1}`,
    originalText: c.originalText,
    summary: c.summary,
    entities: c.entities,
    riskPhrases: mergeRiskPhrases(c.originalText, c.riskPhrases),
    pubmedQuery: c.pubmedQuery,
    trialsQuery: c.trialsQuery,
    origin: resolveOrigin(c.segmentId, c.originalText, segments),
  }));
  return { drafts, visualNotes: out.visualNotes, isHealth: out.isHealthContent };
}

function extractWithRules(segments: Segment[]): DraftClaim[] {
  const drafts: DraftClaim[] = [];
  // 위험 표현이 있는 문장을 먼저, 그다음 의학 키워드 문장 (짧은 메뉴·제목 문구는 제외)
  const candidates = segments
    .flatMap((seg) => splitSentences(seg.text).map((sentence) => ({ seg, sentence })))
    .map((c, order) => ({ ...c, order, risky: detectRiskPhrases(c.sentence).length > 0 }))
    .filter(({ sentence, risky }) => (risky || sentence.length >= 12) && (risky || looksMedical(sentence)))
    .sort((a, b) => Number(b.risky) - Number(a.risky) || a.order - b.order)
    .slice(0, LIMITS.maxClaims)
    .sort((a, b) => a.order - b.order);
  for (const { seg, sentence } of candidates) {
    const numbers = sentence.match(/\d+(\.\d+)?\s*(%|배|주|일|개월|kg|명|건)/g) ?? [];
    drafts.push({
      id: `C${drafts.length + 1}`,
      originalText: sentence,
      summary: sentence,
      entities: { drugs: [], ingredients: [], diseases: [], effects: [], numbers },
      riskPhrases: mergeRiskPhrases(sentence, []),
      pubmedQuery: buildEnglishQuery(sentence),
      trialsQuery: "",
      origin: seg.origin,
    });
  }
  return drafts;
}

/* ────────────────────────── 3단계: 근거 검색 ────────────────────────── */

async function gatherEvidence(drafts: DraftClaim[], ai: boolean, emit: Emit) {
  const searchLog: AnalysisResult["searchLog"] = [];
  const pool = new Map<string, Source>();
  const claimSources = new Map<string, string[]>();

  const pubQueries = [...new Set(drafts.map((d) => d.pubmedQuery.trim()).filter(Boolean))];
  const trialQueries = [...new Set(drafts.map((d) => d.trialsQuery.trim()).filter(Boolean))].slice(0, 4);

  emit({ type: "log", message: `PubMed 검색 ${pubQueries.length}건, ClinicalTrials.gov 검색 ${trialQueries.length}건 실행 중…` });

  const pubPromise = searchPubmed(pubQueries, 3).catch((e: Error) => {
    searchLog.push({ provider: "PubMed", query: pubQueries.join(" / "), count: 0, ok: false, note: e.message });
    return null;
  });
  const trialPromise = Promise.all(
    trialQueries.map(async (q) => {
      try {
        const s = await searchClinicalTrials(q, 2);
        searchLog.push({ provider: "ClinicalTrials.gov", query: q, count: s.length, ok: true });
        return { q, s };
      } catch (e) {
        searchLog.push({ provider: "ClinicalTrials.gov", query: q, count: 0, ok: false, note: (e as Error).message });
        return { q, s: [] as Source[] };
      }
    }),
  );
  const officialPromise = ai
    ? searchOfficialSources(drafts.map((d) => d.summary)).catch((e: Error) => {
        searchLog.push({ provider: "공식기관 웹 검색", query: "-", count: 0, ok: false, note: e.message });
        return null;
      })
    : Promise.resolve(null);

  const [pub, trials, official] = await Promise.all([pubPromise, trialPromise, officialPromise]);

  if (pub) {
    for (const s of pub.sources) pool.set(s.id, s);
    for (const b of pub.byQuery) {
      searchLog.push({ provider: "PubMed", query: b.query, count: b.ids.length, ok: b.ok, note: b.note });
      for (const d of drafts.filter((x) => x.pubmedQuery.trim() === b.query)) {
        claimSources.set(d.id, [...(claimSources.get(d.id) ?? []), ...b.ids.map((id) => `pubmed:${id}`).filter((id) => pool.has(id))]);
      }
    }
  }
  for (const { q, s } of trials) {
    for (const src of s) pool.set(src.id, src);
    for (const d of drafts.filter((x) => x.trialsQuery.trim() === q)) claimSources.set(d.id, [...(claimSources.get(d.id) ?? []), ...s.map((x) => x.id)]);
  }
  if (official) {
    for (const s of official.sources) pool.set(s.id, s);
    searchLog.push({
      provider: "공식기관 웹 검색 (식약처·질병관리청·국립암센터·WHO 등)",
      query: official.searches.join(" / ") || "-",
      count: official.sources.length,
      ok: true,
      note: official.sources.length === 0 ? "인용 가능한 공식 자료를 찾지 못함" : undefined,
    });
  }
  return { pool, claimSources, searchLog };
}

/* ────────────────────────── 4단계: 검증 ────────────────────────── */

function sourceForPrompt(s: Source): string {
  return `<source id="${s.id}"${s.titleOnly ? ' content="title-only"' : ""}>\n제목: ${s.title}\n발행: ${s.publisher}${s.date ? ` (${s.date})` : ""}\n연구 유형: ${STUDY_TYPE_META[s.studyType].label} — ${s.studyTypeBasis}\n내용: ${s.snippet}\n</source>`;
}

async function verifyWithAi(drafts: DraftClaim[], pool: Map<string, Source>, visualNotes: string) {
  const claimsText = drafts
    .map((d) => `<claim id="${d.id}">\n원문: ${d.originalText}\n요약: ${d.summary}\n위험 표현: ${d.riskPhrases.join(", ") || "없음"}\n</claim>`)
    .join("\n");
  const sourcesNote = [...pool.values()].some((s) => s.titleOnly) ? '\ncontent="title-only" 출처는 본문을 확인하지 못했으므로 stance를 context로만 사용하세요.\n' : "";
  const sourcesText = pool.size > 0 ? [...pool.values()].map(sourceForPrompt).join("\n") : "(검색된 출처 없음)";
  const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [
    {
      type: "text",
      text: `<sources>\n${sourcesText}\n</sources>${sourcesNote}\n\n<claims>\n${claimsText}\n</claims>\n${visualNotes ? `\n<visual_notes>${visualNotes}</visual_notes>\n` : ""}\n각 주장을 위 출처만으로 검증하세요. 모든 claimId에 대해 결과를 반환하세요.`,
    },
  ];
  return callStructured({ system: VERIFY_SYSTEM, content, schema: VerificationSchema, effort: "high" });
}

function demoHarm(text: string): HarmLevel {
  const hits = detectRiskPhrases(text).map((h) => h.rule.id);
  if (hits.includes("replace_treatment")) return "high";
  if (/(암|종양|백혈병|림프종)/.test(text) && hits.some((h) => ["complete_cure", "percent_cure", "all_disease"].includes(h))) return "high";
  if (hits.length > 0) return "medium";
  return "low";
}

function verifyWithRules(drafts: DraftClaim[], claimSources: Map<string, string[]>): ClaimResult[] {
  return drafts.map((d) => {
    const hits = detectRiskPhrases(d.originalText);
    const absolute = hits.filter((h) => h.rule.absolute);
    const ids = claimSources.get(d.id) ?? [];
    const base: ClaimResult = {
      ...d,
      verdict: absolute.length > 0 ? "EXAGGERATED" : "UNVERIFIABLE",
      reasoning:
        absolute.length > 0
          ? `[규칙 기반 데모 판정] 의학적으로 보장할 수 없는 절대적·단정적 표현(${absolute.map((h) => `'${h.match}'`).join(", ")})이 탐지되었습니다. 근거 문헌의 내용 검토는 수행되지 않았습니다.`
          : "[데모 모드] AI 검증이 비활성화되어 근거 문헌을 읽고 판정하지 않았습니다. 아래 검색 결과를 직접 확인하세요.",
      supportingEvidence: "데모 모드에서는 근거 내용을 평가하지 않습니다.",
      counterEvidence: "데모 모드에서는 근거 내용을 평가하지 않습니다.",
      scientificExplanation: hits.length > 0 ? `탐지된 표현 유형: ${hits.map((h) => h.rule.label).join(", ")}` : "",
      limitations: "규칙 기반 탐지는 문맥을 이해하지 못하며, 오탐·미탐이 있을 수 있습니다.",
      citations: ids.map((id) => ({ sourceId: id, stance: "context" as const, relevance: "자동 생성 검색어로 찾은 문헌 (관련성 미검토)", limitation: "내용 검토 전 — 판정 근거로 사용되지 않음" })),
      harmPotential: demoHarm(d.originalText),
      needsFurtherVerification: true,
      confidence: { level: "low", basis: "" },
      adjustments: [],
    };
    return base;
  });
}

/* ────────────────────────── 오케스트레이터 ────────────────────────── */

export async function runAnalysis(payload: AnalyzePayload, files: Map<string, UploadedFile>, emit: Emit): Promise<AnalysisResult> {
  const ai = isAiEnabled();
  const mode = ai ? "ai" : "demo";

  emit({ type: "step", step: "collect", status: "start" });
  const { segments, modelMedia, media, warnings } = await collect(payload, files, emit);
  if (segments.length === 0 && modelMedia.length === 0) {
    throw new Error(warnings[0] ?? "분석할 내용이 없습니다. 텍스트를 입력하거나 파일을 첨부해 주세요.");
  }
  emit({ type: "step", step: "collect", status: "done", detail: `입력 구간 ${segments.length}개${modelMedia.length ? ` · 미디어 ${modelMedia.length}개` : ""}` });

  emit({ type: "step", step: "extract", status: "start" });
  let drafts: DraftClaim[];
  let visualNotes = "";
  if (ai) {
    const r = await extractWithAi(segments, modelMedia);
    drafts = r.drafts;
    visualNotes = r.visualNotes;
    if (!r.isHealth) warnings.push("AI가 이 입력을 의약품·건강 관련 내용이 아니라고 판단했습니다.");
  } else {
    drafts = extractWithRules(segments);
  }
  emit({ type: "step", step: "extract", status: "done", detail: `주장 ${drafts.length}개 추출` });

  emit({ type: "step", step: "search", status: "start" });
  const { pool, claimSources, searchLog } = drafts.length ? await gatherEvidence(drafts, ai, emit) : { pool: new Map<string, Source>(), claimSources: new Map<string, string[]>(), searchLog: [] };
  emit({ type: "step", step: "search", status: "done", detail: `실제 검색 출처 ${pool.size}건 확보` });

  emit({ type: "step", step: "verify", status: "start" });
  let claims: ClaimResult[];
  let overallSummary: string;
  let consumerCautions: string[];
  if (drafts.length === 0) {
    claims = [];
    overallSummary = "검증할 수 있는 의학적 주장을 찾지 못했습니다.";
    consumerCautions = [];
  } else if (ai) {
    const v = await verifyWithAi(drafts, pool, visualNotes);
    const byId = new Map(v.claims.map((c) => [c.claimId, c]));
    claims = drafts.map((d) => {
      const r = byId.get(d.id);
      if (!r) {
        return {
          ...d,
          verdict: "UNVERIFIABLE" as const,
          reasoning: "AI 검증 결과가 누락되어 판정을 보류했습니다.",
          supportingEvidence: "",
          counterEvidence: "",
          scientificExplanation: "",
          limitations: "",
          citations: [],
          harmPotential: "low" as const,
          needsFurtherVerification: true,
          confidence: { level: "low" as const, basis: "" },
          adjustments: ["AI 응답에 이 주장의 결과가 없었습니다."],
        };
      }
      return {
        ...d,
        verdict: r.verdict,
        reasoning: r.reasoning,
        supportingEvidence: r.supportingEvidence,
        counterEvidence: r.counterEvidence,
        scientificExplanation: r.scientificExplanation,
        limitations: r.limitations,
        citations: r.citations,
        harmPotential: r.harmPotential,
        needsFurtherVerification: r.needsFurtherVerification,
        confidence: { level: "low" as const, basis: "" },
        adjustments: [],
      };
    });
    overallSummary = v.overallSummary;
    consumerCautions = v.consumerCautions;
  } else {
    claims = verifyWithRules(drafts, claimSources);
    const flagged = claims.filter((c) => c.verdict === "EXAGGERATED").length;
    overallSummary = `[데모 모드 결과] 주장 ${claims.length}개를 규칙 기반으로 추출했고, 그중 ${flagged}개에서 의학적으로 보장할 수 없는 절대적 표현을 탐지했습니다. 이 결과는 AI 검증이 아니며, 진실·허위 판정은 수행하지 않았습니다. 정확한 분석을 위해 서버에 ANTHROPIC_API_KEY를 설정하세요.`;
    consumerCautions = [
      "'100% 완치', '부작용 없음' 같은 절대적 표현은 의학적으로 보장될 수 없습니다.",
      "건강기능식품은 질병을 치료하는 의약품이 아닙니다.",
      "치료를 바꾸거나 중단하기 전에 반드시 담당 의사와 상담하세요.",
    ];
  }

  // 안전장치 + 근거 기반 신뢰도 계산
  claims = claims.map((c) => {
    const enforced = enforceEvidenceRules(c, pool);
    return { ...enforced, confidence: claimConfidence(enforced, pool) };
  });
  emit({ type: "step", step: "verify", status: "done", detail: `${claims.length}개 주장 판정` });

  emit({ type: "step", step: "report", status: "start" });
  const usedIds = new Set(claims.flatMap((c) => c.citations.map((x) => x.sourceId)));
  const sources = [...pool.values()].filter((s) => usedIds.has(s.id));
  const result: AnalysisResult = {
    id: newId(),
    version: 1,
    mode,
    createdAt: new Date().toISOString(),
    inputSummary: {
      text: payload.text.slice(0, 2000),
      url: payload.url,
      files: [...files.values()].filter((f) => !f.name.startsWith("__frame")).map((f) => ({ name: f.name, kind: f.mime, size: f.bytes.byteLength })),
    },
    overallSummary,
    consumerCautions,
    claims,
    sources,
    ratio: computeRatio(claims.map((c) => c.verdict)),
    risk: computeRisk(claims),
    analysisConfidence: analysisConfidence(claims, pool, mode),
    searchLog,
    warnings,
    media,
    model: ai ? AI_MODEL : null,
  };
  emit({ type: "step", step: "report", status: "done" });
  return result;
}
