/**
 * 규칙 기반 위험 표현 탐지기.
 * - AI 모드: 모델 출력과 별개로 위험 표현을 결정적으로 표시하는 보조 수단
 * - 데모 모드: 주장 추출·과장 표현 탐지의 유일한 수단 (진실/허위 판정은 하지 않음)
 */

export interface RiskRule {
  id: string;
  label: string;
  pattern: RegExp;
  /** 절대적·단정적 표현이면 과장으로 볼 수 있는 강한 신호 */
  absolute: boolean;
}

export const RISK_RULES: RiskRule[] = [
  { id: "percent_cure", label: "100% 효과·완치 단정", pattern: /100\s*%\s*(완치|치료|효과|예방|제거|사멸|흡수|성공)|완치율\s*100/, absolute: true },
  { id: "complete_cure", label: "완치·근치 보장", pattern: /(완치|근치|완전히?\s*(낫|치료|사라|제거)|씻은\s*듯)/, absolute: true },
  { id: "all_disease", label: "모든 질병·만병통치", pattern: /(모든\s*(암|질병|병|종류의\s*암)|만병통치|만능|어떤\s*암이든)/, absolute: true },
  { id: "no_side_effect", label: "부작용 없음 단정", pattern: /부작용(이|은|도)?\s*(전혀\s*)?(없|zero|제로|0\s*%)/i, absolute: true },
  { id: "guarantee", label: "효과 보장·확실", pattern: /(효과\s*(보장|확실)|무조건|반드시\s*(낫|효과|빠)|확실하게\s*(낫|치료)|기적)/, absolute: true },
  { id: "doctor_endorse", label: "의사·전문가 추천 표방", pattern: /(의사|약사|전문의|교수|박사)\s*(가|들이|도)?\s*(추천|인정|극찬|보증)/, absolute: false },
  { id: "clinical_proven", label: "임상 입증 주장", pattern: /(임상(적으로|시험)?\s*(으로|에서)?\s*(입증|증명|검증)|과학적으로\s*(입증|증명))/, absolute: false },
  { id: "approval_claim", label: "허가·인증 표방", pattern: /(식약처|FDA|WHO)\s*(가|에서)?\s*(인정|승인|허가|인증)/, absolute: false },
  { id: "replace_treatment", label: "표준 치료 대체·중단 권유", pattern: /(항암제|항암\s*치료|병원\s*치료|수술|(?<![가-힣])약)\s*(없이|대신|[을를]?\s*끊|[을를]?\s*중단|[을를]?\s*(쓸|받을|할)?\s*필요\s*(가\s*)?없)|(치료|(?<![가-힣])약)\s*(를|을)?\s*(거부|중단)/, absolute: true },
  { id: "sole_remedy", label: "단일 요법으로 중증 질환 치료 주장", pattern: /(만으로|만\s*(먹어|마셔|발라)도)\s*(\S+\s*){0,2}(암|종양|림프종|백혈병|당뇨|질병)\S*\s*(을|를)?\s*(치료|완치|극복|고칠|낫)/, absolute: true },
  { id: "rapid_effect", label: "단기간 극적 효과", pattern: /(\d+\s*(일|주|시간)\s*(만에|안에)\s*\S*\s*(감량|완치|효과|사라|빠))|(먹기만\s*하면|바르기만\s*하면)/, absolute: true },
  { id: "ai_hype", label: "AI 개발 = 효과 보장 프레임", pattern: /(AI|인공지능)\s*(가|이)?\s*(개발|발굴|설계|추천)\S*\s*.*(확실|완치|정복|보장|100\s*%)/i, absolute: true },
  { id: "conspiracy", label: "은폐·음모론 프레임", pattern: /(숨기|은폐|감추|카르텔|음모)/, absolute: false },
];

const MEDICAL_KEYWORDS =
  /(암|종양|항암|신약|약|치료|완치|질병|질환|효과|임상|부작용|성분|면역|당뇨|비만|다이어트|체중|감량|혈압|콜레스테롤|백신|바이러스|감염|건강기능식품|영양제|비타민|유산균|식약처|의사|처방|세포|인공지능|(?<![A-Za-z])AI(?![A-Za-z])|\b(cancer|drugs?|cure[sd]?|tumou?rs?|clinical|vaccines?|supplements?)\b)/i;

export function detectRiskPhrases(text: string): { rule: RiskRule; match: string }[] {
  const hits: { rule: RiskRule; match: string }[] = [];
  for (const rule of RISK_RULES) {
    const m = text.match(rule.pattern);
    if (m) hits.push({ rule, match: m[0].trim() });
  }
  return hits;
}

export function looksMedical(text: string): boolean {
  return MEDICAL_KEYWORDS.test(text);
}

/** 한국어·영어 혼합 문장 분리 (원문 보존) */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/(?<=[.!?。！？])\s+|(?<=다\.)\s*|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 6);
}

/** 이진 분류 기준선 — 위험 표현이 하나라도 있으면 1(허위·과장 의심) */
export function baselineClassify(text: string): 0 | 1 {
  return detectRiskPhrases(text).length > 0 ? 1 : 0;
}

/** 데모 모드용 한→영 PubMed 검색어 사전 */
const TERM_MAP: [RegExp, string][] = [
  [/항암|암|종양|말기암|림프종/, "cancer"],
  [/대장암/, "colorectal cancer"],
  [/위암/, "gastric cancer"],
  [/유방암/, "breast cancer"],
  [/폐암/, "lung cancer"],
  [/신약|후보\s*물질/, "drug development"],
  [/(?<![A-Za-z])AI(?![A-Za-z])|인공지능/, "artificial intelligence"],
  [/임상/, "clinical trial"],
  [/완치|치료/, "treatment"],
  [/비만|다이어트|체중|감량/, "obesity weight loss"],
  [/위고비|세마글루타이드/, "semaglutide"],
  [/삭센다|리라글루타이드/, "liraglutide"],
  [/면역/, "immune"],
  [/비타민\s*C|고용량\s*비타민/, "high-dose vitamin C"],
  [/비타민/, "vitamin"],
  [/구충제|펜벤다졸/, "fenbendazole"],
  [/수소수/, "hydrogen water"],
  [/레몬|베이킹소다|알칼리/, "alkaline diet"],
  [/크릴오일/, "krill oil"],
  [/타트체리/, "tart cherry"],
  [/유산균|프로바이오틱스/, "probiotics"],
  [/백신/, "vaccine"],
  [/부작용/, "adverse effects"],
  [/세포치료제/, "cell therapy"],
  [/허브|약초|추출물/, "herbal extract"],
];

export function buildEnglishQuery(text: string): string {
  const terms: string[] = [];
  for (const [re, en] of TERM_MAP) if (re.test(text) && !terms.includes(en)) terms.push(en);
  const latin = (text.match(/[A-Za-z][A-Za-z0-9-]{2,}/g) ?? []).filter((w) => !/^(AI|the|and)$/i.test(w));
  for (const w of latin) if (terms.length < 5 && !terms.some((t) => t.toLowerCase().includes(w.toLowerCase()))) terms.push(w);
  return terms.slice(0, 4).join(" ");
}
