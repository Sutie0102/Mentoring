import type { StudyType } from "../types";

/** PubMed 출판 유형 + 제목·초록 키워드로 연구 유형을 결정적으로 분류한다. */
export function classifyPubmed(pubtypes: string[], title: string, abstract: string): { type: StudyType; basis: string } {
  const pt = pubtypes.map((p) => p.toLowerCase());
  const has = (s: string) => pt.some((p) => p.includes(s));
  if (has("systematic review") || has("meta-analysis")) return { type: "systematic_review", basis: "PubMed 출판 유형: Systematic Review/Meta-Analysis" };
  if (has("randomized controlled trial")) return { type: "rct", basis: "PubMed 출판 유형: Randomized Controlled Trial" };
  if (has("practice guideline") || has("guideline")) return { type: "regulatory", basis: "PubMed 출판 유형: Guideline" };

  const text = `${title} ${abstract}`.toLowerCase();
  const cell = /\b(in vitro|cell line|cell lines|cultured cells|hela|mcf-7|a549|hepg2)\b/.test(text);
  const animal = /\b(mice|mouse|murine|rats?|xenograft|zebrafish|rabbits?|in vivo model|animal model)\b/.test(text);
  const human = /\b(patients|participants|subjects|volunteers|women|men|children|adults|cohort)\b/.test(text);
  if (cell && !human && !animal) return { type: "cell", basis: "제목·초록 키워드(in vitro/cell line) 기반 자동 분류" };
  if (animal && !human) return { type: "animal", basis: "제목·초록 키워드(mice/rat 등) 기반 자동 분류" };

  if (has("observational study") || /\b(cohort|case-control|cross-sectional|retrospective|prospective)\b/.test(text))
    return { type: "observational", basis: "출판 유형 또는 키워드(cohort/case-control 등) 기반 자동 분류" };
  if (has("clinical trial")) return { type: "rct", basis: "PubMed 출판 유형: Clinical Trial (무작위 여부 미확인)" };
  if (has("review") || has("editorial") || has("comment")) return { type: "expert_opinion", basis: "PubMed 출판 유형: Review/Editorial" };
  if (cell) return { type: "cell", basis: "제목·초록 키워드 기반 자동 분류" };
  return { type: "other", basis: "출판 유형만으로 연구 설계를 판별할 수 없음" };
}
