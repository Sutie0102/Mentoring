import "server-only";
import type { Source } from "../types";
import { classifyPubmed } from "./studyType";

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

function commonParams(): string {
  const p = new URLSearchParams({ tool: "medfact-ai" });
  if (process.env.NCBI_API_KEY) p.set("api_key", process.env.NCBI_API_KEY);
  if (process.env.NCBI_EMAIL) p.set("email", process.env.NCBI_EMAIL);
  return p.toString();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** NCBI 권장: API 키 없이 초당 3회 이하 */
const gap = () => sleep(process.env.NCBI_API_KEY ? 110 : 350);

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000), cache: "no-store" });
  if (!res.ok) throw new Error(`PubMed HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function pubmedSearchIds(query: string, retmax = 3): Promise<string[]> {
  const url = `${BASE}/esearch.fcgi?db=pubmed&retmode=json&sort=relevance&retmax=${retmax}&term=${encodeURIComponent(query)}&${commonParams()}`;
  const data = await getJson<{ esearchresult?: { idlist?: string[] } }>(url);
  return data.esearchresult?.idlist ?? [];
}

interface ESummaryItem {
  uid: string;
  title: string;
  fulljournalname?: string;
  source?: string;
  pubdate?: string;
  pubtype?: string[];
}

function decodeXml(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** efetch XML에서 PMID별 초록 추출 */
async function fetchAbstracts(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const url = `${BASE}/efetch.fcgi?db=pubmed&retmode=xml&id=${ids.join(",")}&${commonParams()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000), cache: "no-store" });
  if (!res.ok) return out;
  const xml = await res.text();
  for (const article of xml.split("<PubmedArticle>").slice(1)) {
    const pmid = /<PMID[^>]*>(\d+)<\/PMID>/.exec(article)?.[1];
    if (!pmid) continue;
    const parts = [...article.matchAll(/<AbstractText([^>]*)>([\s\S]*?)<\/AbstractText>/g)].map((m) => {
      const label = /Label="([^"]+)"/.exec(m[1])?.[1];
      return `${label ? label + ": " : ""}${decodeXml(m[2])}`;
    });
    out.set(pmid, parts.join(" "));
  }
  return out;
}

/** 여러 검색어를 순차 조회(요청 한도 준수) 후 요약·초록을 한 번에 가져온다. */
export async function searchPubmed(
  queries: string[],
  perQuery = 3,
): Promise<{ sources: Source[]; byQuery: { query: string; ids: string[]; ok: boolean; note?: string }[] }> {
  const byQuery: { query: string; ids: string[]; ok: boolean; note?: string }[] = [];
  for (const q of queries) {
    try {
      const ids = await pubmedSearchIds(q, perQuery);
      byQuery.push({ query: q, ids, ok: true });
    } catch (e) {
      byQuery.push({ query: q, ids: [], ok: false, note: (e as Error).message });
    }
    await gap();
  }
  const allIds = [...new Set(byQuery.flatMap((b) => b.ids))];
  if (allIds.length === 0) return { sources: [], byQuery };

  const summary = await getJson<{ result?: Record<string, ESummaryItem> & { uids?: string[] } }>(
    `${BASE}/esummary.fcgi?db=pubmed&retmode=json&id=${allIds.join(",")}&${commonParams()}`,
  );
  await gap();
  const abstracts = await fetchAbstracts(allIds).catch(() => new Map<string, string>());

  const sources: Source[] = [];
  for (const id of allIds) {
    const item = summary.result?.[id] as ESummaryItem | undefined;
    if (!item?.title) continue;
    const abstract = abstracts.get(id) ?? "";
    const st = classifyPubmed(item.pubtype ?? [], item.title, abstract);
    sources.push({
      id: `pubmed:${id}`,
      provider: "pubmed",
      title: decodeXml(item.title),
      publisher: item.fulljournalname || item.source || "PubMed",
      date: item.pubdate ?? null,
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      studyType: st.type,
      studyTypeBasis: st.basis,
      snippet: abstract ? abstract.slice(0, 1800) : "(초록 없음 — 제목만 확인됨)",
    });
  }
  return { sources, byQuery };
}
