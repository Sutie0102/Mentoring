import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL, FALLBACK_BETA, getClient, normalizeAiError } from "../ai/client";
import { OFFICIAL_SEARCH_SYSTEM } from "../ai/prompts";
import { OFFICIAL_DOMAINS } from "../constants";
import type { Source } from "../types";

const PUBLISHERS: [RegExp, string][] = [
  [/nedrug\.mfds\.go\.kr/, "의약품안전나라(식품의약품안전처)"],
  [/mfds\.go\.kr/, "식품의약품안전처"],
  [/foodsafetykorea\.go\.kr/, "식품안전나라(식품의약품안전처)"],
  [/kdca\.go\.kr/, "질병관리청"],
  [/cancer\.go\.kr/, "국가암정보센터(국립암센터)"],
  [/ncc\.re\.kr/, "국립암센터"],
  [/who\.int/, "세계보건기구(WHO)"],
  [/fda\.gov/, "미국 식품의약국(FDA)"],
  [/ema\.europa\.eu/, "유럽의약품청(EMA)"],
  [/nih\.gov/, "미국 국립보건원(NIH)"],
];

function publisherOf(url: string): string {
  const host = new URL(url).hostname;
  return PUBLISHERS.find(([re]) => re.test(host))?.[1] ?? host;
}

function hashId(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/**
 * Claude 웹 검색(공식 도메인 한정)으로 공공기관 자료를 찾는다.
 * 출처는 모델의 텍스트가 아니라 API가 반환한 검색 결과·인용(cited_text)에서만 만든다.
 */
export async function searchOfficialSources(claims: string[]): Promise<{ sources: Source[]; searches: string[] }> {
  const client = getClient();
  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [
    {
      role: "user",
      content: `다음 주장들에 관한 공식 자료를 찾아 주세요.\n\n${claims.map((c, i) => `${i + 1}. ${c}`).join("\n")}`,
    },
  ];
  const byUrl = new Map<string, { title: string; pageAge: string | null; cited: string[] }>();
  const searches: string[] = [];

  try {
    for (let turn = 0; turn < 3; turn++) {
      const stream = client.beta.messages.stream({
        model: AI_MODEL,
        max_tokens: 16000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
        system: OFFICIAL_SEARCH_SYSTEM,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5, allowed_domains: OFFICIAL_DOMAINS }],
        messages,
      });
      const msg = await stream.finalMessage();
      for (const block of msg.content) {
        if (block.type === "server_tool_use" && block.name === "web_search") {
          const q = (block.input as { query?: string })?.query;
          if (q) searches.push(q);
        }
        if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
          for (const r of block.content) {
            if (r.type !== "web_search_result") continue;
            if (!byUrl.has(r.url)) byUrl.set(r.url, { title: r.title, pageAge: r.page_age ?? null, cited: [] });
          }
        }
        if (block.type === "text" && block.citations) {
          for (const c of block.citations) {
            if (c.type !== "web_search_result_location" || !c.url) continue;
            const entry = byUrl.get(c.url) ?? { title: c.title ?? c.url, pageAge: null, cited: [] };
            if (c.cited_text && !entry.cited.includes(c.cited_text)) entry.cited.push(c.cited_text);
            byUrl.set(c.url, entry);
          }
        }
      }
      if (msg.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: msg.content as Anthropic.Beta.Messages.BetaContentBlockParam[] });
    }
  } catch (e) {
    throw normalizeAiError(e);
  }

  const sources: Source[] = [];
  for (const [url, v] of byUrl) {
    // 인용 발췌가 없는 결과는 내용을 확인할 수 없으므로 '제목만 확인'으로 표시 (판정 근거 불가)
    const titleOnly = v.cited.length === 0;
    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      continue;
    }
    const isLiterature = /pubmed|ncbi|pmc/.test(host);
    sources.push({
      id: `web:${hashId(url)}`,
      provider: "official_web",
      title: v.title,
      publisher: publisherOf(url),
      date: v.pageAge,
      url,
      studyType: isLiterature ? "other" : "regulatory",
      studyTypeBasis: isLiterature ? "문헌 데이터베이스 페이지 (연구 설계 미분류)" : "공식 기관 웹페이지",
      snippet: titleOnly ? "(검색 결과 제목만 확인 — 본문 발췌 없음. 판정 근거로 사용하지 않습니다.)" : v.cited.join(" … ").slice(0, 1800),
      titleOnly,
    });
  }
  const verified = sources.filter((s) => !s.titleOnly);
  const titleOnly = sources.filter((s) => s.titleOnly).slice(0, 6);
  return { sources: [...verified, ...titleOnly], searches };
}
