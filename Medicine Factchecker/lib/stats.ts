import { HARM_WEIGHT, STUDY_TYPE_META } from "./constants";
import type {
  ClaimResult,
  ConfidenceLevel,
  RiskLevel,
  Source,
  Verdict,
  VerdictRatio,
} from "./types";
import { VERDICTS } from "./types";

/**
 * 주장 분류 비율 — '진실일 확률'이 아니라 추출된 주장 개수 중 각 분류가 차지하는 비율.
 * 최대 잔여 방식(largest remainder)으로 정수 반올림해 합계가 정확히 100이 되도록 한다.
 */
export function computeRatio(verdicts: Verdict[]): VerdictRatio {
  const ratio: VerdictRatio = { TRUE: 0, EXAGGERATED: 0, FALSE: 0, UNVERIFIABLE: 0 };
  const total = verdicts.length;
  if (total === 0) {
    ratio.UNVERIFIABLE = 100;
    return ratio;
  }
  const counts = VERDICTS.map((v) => verdicts.filter((x) => x === v).length);
  const exact = counts.map((c) => (c / total) * 100);
  const floors = exact.map(Math.floor);
  let remaining = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((e, i) => ({ i, rem: e - Math.floor(e) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of order) {
    if (remaining <= 0) break;
    floors[i] += 1;
    remaining -= 1;
  }
  VERDICTS.forEach((v, i) => (ratio[v] = floors[i]));
  return ratio;
}

const RISK_BASE: Record<Verdict, number> = { TRUE: 0, EXAGGERATED: 0.5, FALSE: 1, UNVERIFIABLE: 0 };

/**
 * 종합 위험도. 의료 위해 가능성(harmPotential)이 큰 허위·과장 주장에 더 큰 가중치를 준다.
 * 판단 가능한 주장이 없으면 '판단 보류'.
 */
export function computeRisk(claims: Pick<ClaimResult, "verdict" | "harmPotential">[]): {
  level: RiskLevel;
  score: number | null;
  basis: string;
} {
  const judged = claims.filter((c) => c.verdict !== "UNVERIFIABLE");
  if (judged.length === 0) {
    return { level: "pending", score: null, basis: "판정 가능한 주장이 없어 위험도를 산출하지 않았습니다." };
  }
  const hasSevereFalse = judged.some((c) => c.verdict === "FALSE" && c.harmPotential === "high");
  const weightSum = judged.reduce((s, c) => s + HARM_WEIGHT[c.harmPotential], 0);
  const raw = judged.reduce((s, c) => s + RISK_BASE[c.verdict] * HARM_WEIGHT[c.harmPotential], 0);
  const score = Math.round((raw / weightSum) * 100);
  const problematic = judged.filter((c) => c.verdict === "FALSE" || c.verdict === "EXAGGERATED").length;
  const unverifiableShare = (claims.length - judged.length) / claims.length;

  let level: RiskLevel;
  if (hasSevereFalse || score >= 45) level = "high";
  else if (score >= 15) level = "caution";
  else level = "low";
  if (problematic === 0 && unverifiableShare > 0.5) level = "pending";

  const parts = [
    `판정된 주장 ${judged.length}개의 위해 가중 점수 ${score}/100`,
    hasSevereFalse ? "의료 위해 가능성이 큰 허위 주장 포함" : null,
    unverifiableShare > 0 ? `판단 불가 ${claims.length - judged.length}개는 점수에서 제외` : null,
  ].filter(Boolean);
  return { level, score, basis: parts.join(" · ") };
}

function levelFromScore(score: number): ConfidenceLevel {
  if (score >= 0.8) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

/** 주장별 근거 점수(0~1) — 인용된 실제 출처의 연구 유형과 개수로만 계산 */
export function claimEvidenceScore(claim: Pick<ClaimResult, "verdict" | "citations">, sources: Map<string, Source>): number {
  if (claim.verdict === "UNVERIFIABLE") return 0;
  const weights = claim.citations
    .filter((c) => c.stance !== "context")
    .map((c) => sources.get(c.sourceId))
    .filter((s): s is Source => !!s)
    .map((s) => STUDY_TYPE_META[s.studyType].weight);
  if (weights.length === 0) return 0.1;
  const best = Math.max(...weights);
  return Math.min(1, best + Math.min(0.1 * (weights.length - 1), 0.2));
}

export function claimConfidence(
  claim: Pick<ClaimResult, "verdict" | "citations">,
  sources: Map<string, Source>,
): { level: ConfidenceLevel; basis: string } {
  const used = claim.citations
    .filter((c) => c.stance !== "context")
    .map((c) => sources.get(c.sourceId))
    .filter((s): s is Source => !!s);
  if (claim.verdict === "UNVERIFIABLE") {
    return { level: "low", basis: "판정을 뒷받침할 근거를 확보하지 못했습니다." };
  }
  if (used.length === 0) {
    return { level: "low", basis: "외부 근거 없이 광고 표현(절대적·단정적 문구)만으로 판단했습니다." };
  }
  const score = claimEvidenceScore(claim, sources);
  const best = used.reduce((a, b) => (STUDY_TYPE_META[a.studyType].weight >= STUDY_TYPE_META[b.studyType].weight ? a : b));
  return {
    level: levelFromScore(score),
    basis: `근거 ${used.length}건 · 최고 근거 수준: ${STUDY_TYPE_META[best.studyType].label}`,
  };
}

export function analysisConfidence(
  claims: Pick<ClaimResult, "verdict" | "citations">[],
  sources: Map<string, Source>,
  mode: "ai" | "demo" | "sample",
): { level: ConfidenceLevel; basis: string } {
  if (claims.length === 0) return { level: "low", basis: "검증할 주장을 찾지 못했습니다." };
  const scores = claims.map((c) => claimEvidenceScore(c, sources));
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const backed = scores.filter((s) => s >= 0.3).length;
  const basis = `주장 ${claims.length}개 중 ${backed}개가 외부 근거로 판정됨 (근거 점수 평균 ${avg.toFixed(2)})`;
  if (mode === "demo") return { level: "low", basis: `데모(규칙 기반) 모드 — AI 검증이 수행되지 않았습니다. ${basis}` };
  return { level: levelFromScore(avg), basis };
}

/**
 * 판정 안전장치 — AI의 추측만으로 진실/허위를 확정하지 않는다.
 * 1) 출처 풀에 없는 sourceId 인용은 제거
 * 2) TRUE/FALSE인데 실제 근거 인용이 없으면 UNVERIFIABLE로 보류
 * 3) TRUE의 근거가 세포·동물실험뿐이면 사람 대상 효과로 확대 해석하지 않도록 EXAGGERATED로 조정
 */
export function enforceEvidenceRules<T extends Pick<ClaimResult, "verdict" | "citations" | "adjustments" | "needsFurtherVerification">>(
  claim: T,
  sources: Map<string, Source>,
): T {
  const out = { ...claim, citations: [...claim.citations], adjustments: [...claim.adjustments] };
  const before = out.citations.length;
  out.citations = out.citations.filter((c) => sources.has(c.sourceId));
  if (out.citations.length < before) {
    out.adjustments.push(`검색 결과에 없는 출처 ${before - out.citations.length}건을 제거했습니다.`);
  }
  // 제목만 확인된 출처는 내용을 읽지 않았으므로 '참고'로만 인정
  out.citations = out.citations.map((c) => {
    if (c.stance !== "context" && sources.get(c.sourceId)?.titleOnly) {
      out.adjustments.push("본문을 확인하지 못한 출처(제목만 확인)는 판정 근거에서 제외하고 참고로만 표시했습니다.");
      return { ...c, stance: "context" as const };
    }
    return c;
  });
  const evidential = out.citations.filter((c) => c.stance !== "context");
  if ((out.verdict === "TRUE" || out.verdict === "FALSE") && evidential.length === 0) {
    out.adjustments.push(`확인된 근거 없이 '${out.verdict === "TRUE" ? "진실" : "허위"}'로 판정할 수 없어 '판단 불가'로 보류했습니다.`);
    out.verdict = "UNVERIFIABLE";
    out.needsFurtherVerification = true;
  }
  if (out.verdict === "TRUE") {
    const supporting = evidential
      .filter((c) => c.stance === "supports")
      .map((c) => sources.get(c.sourceId)!)
      .filter(Boolean);
    if (supporting.length > 0 && supporting.every((s) => s.studyType === "cell" || s.studyType === "animal")) {
      out.adjustments.push("근거가 세포·동물실험뿐이어서 사람 대상 효과로 확대 해석하지 않도록 '과장'으로 조정했습니다.");
      out.verdict = "EXAGGERATED";
      out.needsFurtherVerification = true;
    }
  }
  return out;
}
