import { analysisConfidence, claimConfidence, computeRatio, computeRisk } from "../stats";
import type { AnalysisResult, ClaimResult, Source } from "../types";

export const SAMPLE_INPUT = "AI가 개발한 신약으로 모든 암을 100% 완치할 수 있습니다.";

/**
 * 샘플 결과 — 실제 AI 분석이 아니라 시연용으로 작성된 결과다.
 * 단, 출처는 2026-11-15 PubMed·WHO에서 직접 조회해 존재를 확인한 자료만 사용했다.
 */
const SOURCES: Source[] = [
  {
    id: "pubmed:38692505",
    provider: "pubmed",
    title: "How successful are AI-discovered drugs in clinical trials? A first analysis and emerging lessons.",
    publisher: "Drug discovery today",
    date: "2024 Jun",
    url: "https://pubmed.ncbi.nlm.nih.gov/38692505/",
    studyType: "observational",
    studyTypeBasis: "AI 바이오텍 임상 파이프라인 정량 분석 (PubMed 출판 유형: Review)",
    snippet:
      "In Phase I we find AI-discovered molecules have an 80-90% success rate, substantially higher than historic industry averages. ... In Phase II the success rate is ∼40%, albeit on a limited sample size, comparable to historic industry averages.",
  },
  {
    id: "pubmed:29394327",
    provider: "pubmed",
    title: "Estimation of clinical trial success rates and related parameters.",
    publisher: "Biostatistics (Oxford, England)",
    date: "2019 Apr 1",
    url: "https://pubmed.ncbi.nlm.nih.gov/29394327/",
    studyType: "observational",
    studyTypeBasis: "임상시험 데이터베이스(406,038건) 후향적 분석",
    snippet:
      "Using a sample of 406 038 entries of clinical trial data for over 21 143 compounds from January 1, 2000 to October 31, 2015 ... oncology has a 3.4% success rate in our sample vs. 5.1% in prior studies.",
  },
  {
    id: "web:who-cancer",
    provider: "official_web",
    title: "Cancer — Fact sheet",
    publisher: "세계보건기구(WHO)",
    date: null,
    url: "https://www.who.int/news-room/fact-sheets/detail/cancer",
    studyType: "regulatory",
    studyTypeBasis: "공식 기관 웹페이지",
    snippet:
      "Cancer is a leading cause of death worldwide, accounting for nearly 10 million deaths in 2024, or nearly one in six deaths. ... Many cancers can be cured if detected early and treated effectively.",
  },
];

const origin = { kind: "text" as const, label: "입력 텍스트" };
const noEntities = { drugs: [], ingredients: [], diseases: [], effects: [], numbers: [] };

const RAW_CLAIMS: Omit<ClaimResult, "confidence">[] = [
  {
    id: "C1",
    originalText: "AI가 개발한 신약",
    summary: "AI를 활용해 신약(후보 물질)을 개발할 수 있다",
    entities: { ...noEntities, drugs: ["AI 개발 신약"] },
    riskPhrases: [],
    verdict: "TRUE",
    reasoning: "AI는 실제로 신약 후보 물질 탐색과 설계에 활용되고 있으며, AI로 발굴한 분자가 임상시험에 진입한 사례가 다수 보고되었습니다.",
    supportingEvidence: "AI 기반 바이오텍의 파이프라인 분석에서 AI 발굴 분자들이 임상 1·2상에 진입해 평가받고 있음이 확인됩니다.",
    counterEvidence: "확인된 반박 근거 없음",
    scientificExplanation: "AI는 방대한 화합물·단백질 데이터를 학습해 약효가 기대되는 후보 물질을 빠르게 추려내는 데 쓰입니다. 다만 이는 개발 과정의 '초기 단계'를 돕는 기술입니다.",
    limitations: "분석 대상이 AI 바이오텍 일부의 파이프라인으로 한정되어 있고, 'AI가 개발했다'의 정의가 회사마다 다릅니다.",
    citations: [
      { sourceId: "pubmed:38692505", stance: "supports", relevance: "AI로 발굴된 분자들이 실제 임상시험 단계에 진입했음을 보여줌", limitation: "AI 관여 정도의 기준이 통일되어 있지 않음" },
    ],
    harmPotential: "low",
    needsFurtherVerification: false,
    adjustments: [],
    origin,
  },
  {
    id: "C2",
    originalText: "AI가 개발한 신약으로 … 완치할 수 있습니다",
    summary: "AI가 개발했으므로 치료 효과가 확실하다",
    entities: noEntities,
    riskPhrases: ["AI가 개발한"],
    verdict: "EXAGGERATED",
    reasoning: "AI가 후보 물질 발굴을 돕는다는 것은 사실이지만, 그 자체가 치료 효과를 보장하지는 않습니다. AI 발굴 분자도 2상 성공률이 약 40%로 기존 업계 평균과 비슷하다는 분석이 있습니다.",
    supportingEvidence: "AI 발굴 분자의 1상(안전성 중심) 성공률은 80~90%로 높게 보고되었습니다.",
    counterEvidence: "효과를 확인하는 2상에서는 약 40%로 기존 평균과 비슷했으며, 최종 승인·치료 효과까지 입증된 것은 아닙니다.",
    scientificExplanation: "신약은 후보 물질 발굴 → 전임상 → 임상 1·2·3상 → 허가 단계를 거칩니다. AI는 앞 단계를 빠르게 할 수 있지만, 사람에게 효과가 있는지는 임상시험으로만 확인됩니다.",
    limitations: "AI 신약의 2상 이후 자료는 표본이 적어 결론이 바뀔 수 있습니다.",
    citations: [
      { sourceId: "pubmed:38692505", stance: "refutes", relevance: "AI 발굴 분자도 효과 확인 단계(2상)에서 성공률이 기존 평균 수준임", limitation: "2상 표본이 작음" },
      { sourceId: "pubmed:29394327", stance: "context", relevance: "일반적인 임상 단계별 성공률 기준선을 제공", limitation: "AI 신약을 별도로 분석하지 않음 (2000~2015 자료)" },
    ],
    harmPotential: "medium",
    needsFurtherVerification: true,
    adjustments: [],
    origin,
  },
  {
    id: "C3",
    originalText: "모든 암을 100% 완치할 수 있습니다",
    summary: "이 신약으로 모든 종류의 암을 100% 완치할 수 있다",
    entities: { ...noEntities, diseases: ["암(전체)"], effects: ["완치"], numbers: ["100%"] },
    riskPhrases: ["모든 암", "100% 완치"],
    verdict: "FALSE",
    reasoning: "암은 수많은 서로 다른 질환의 총칭이며, 모든 암을 100% 완치하는 치료법은 존재하지 않습니다. 항암 분야는 임상시험 성공률이 가장 낮은 분야 중 하나이고, WHO는 암을 전 세계 주요 사망 원인으로 보고합니다.",
    supportingEvidence: "확인된 근거 없음",
    counterEvidence: "항암제의 임상 성공률(1상→승인)은 약 3.4%로 추정됩니다. WHO는 2024년 암으로 약 1,000만 명이 사망했다고 보고하며, '조기 발견·적절한 치료 시 많은 암이 완치될 수 있다'고 할 뿐 모든 암의 완치를 말하지 않습니다.",
    scientificExplanation: "암은 발생 부위·유전자 변이·병기에 따라 치료 반응이 크게 다릅니다. 같은 암이라도 환자마다 효과가 달라, 의학적으로 '100%'라는 표현은 쓸 수 없습니다.",
    limitations: "성공률 연구는 2000~2015년 자료 기반이며, 최근 항암제(면역항암제 등)의 성과는 반영되지 않았습니다. 그러나 '모든 암 100% 완치'를 뒷받침하는 자료는 확인되지 않았습니다.",
    citations: [
      { sourceId: "pubmed:29394327", stance: "refutes", relevance: "항암 분야 임상 성공률이 3.4%로 매우 낮음", limitation: "2015년까지의 자료" },
      { sourceId: "web:who-cancer", stance: "refutes", relevance: "암은 여전히 주요 사망 원인이며 완치는 조기 발견·치료 조건에 따라 일부에서 가능", limitation: "개별 신약을 평가한 자료는 아님" },
    ],
    harmPotential: "high",
    needsFurtherVerification: false,
    adjustments: [],
    origin,
  },
];

export function buildSampleResult(): AnalysisResult {
  const pool = new Map(SOURCES.map((s) => [s.id, s]));
  const claims: ClaimResult[] = RAW_CLAIMS.map((c) => ({ ...c, confidence: claimConfidence(c, pool) }));
  return {
    id: "sample-ai-drug",
    version: 1,
    mode: "sample",
    createdAt: "2026-11-15T00:00:00.000Z",
    inputSummary: { text: SAMPLE_INPUT, url: null, files: [] },
    overallSummary:
      "이 광고는 'AI 신약 개발'이라는 사실에 기반한 표현을 앞세워, 근거 없는 '모든 암 100% 완치'라는 주장을 결합하고 있습니다. AI가 후보 물질 발굴에 쓰이는 것은 사실이지만, 치료 효과는 임상시험으로만 확인되며 모든 암을 완치하는 치료법은 존재하지 않습니다. 표준 치료를 미루게 만들 수 있어 위해 가능성이 큽니다.",
    consumerCautions: [
      "'100% 완치', '모든 암' 같은 절대적 표현은 의학적으로 보장될 수 없습니다.",
      "'AI가 개발했다'는 사실은 효과·안전성의 증거가 아닙니다.",
      "의약품 허가 여부는 의약품안전나라(nedrug.mfds.go.kr)에서 직접 확인할 수 있습니다.",
      "현재 받고 있는 치료를 바꾸거나 중단하기 전에 반드시 담당 의사와 상담하세요.",
    ],
    claims,
    sources: SOURCES,
    ratio: computeRatio(claims.map((c) => c.verdict)),
    risk: computeRisk(claims),
    analysisConfidence: analysisConfidence(claims, pool, "sample"),
    searchLog: [
      { provider: "PubMed", query: "artificial intelligence drug discovery clinical trial success", count: 1, ok: true, note: "샘플 작성 시 수동 조회" },
      { provider: "PubMed", query: "clinical trial success rates oncology", count: 1, ok: true, note: "샘플 작성 시 수동 조회" },
      { provider: "WHO", query: "cancer fact sheet", count: 1, ok: true, note: "샘플 작성 시 수동 조회" },
    ],
    warnings: ["샘플에 인용된 출처는 2026-11-15에 PubMed·WHO에서 직접 조회해 존재와 내용을 확인했습니다."],
    media: [],
    model: null,
  };
}
