/**
 * 자료 A: '1차시_사례카드_20장.pdf' 중 SDG 3(건강) 관련 카드.
 * 카드의 수치는 '해당 PDF의 주장'으로만 표시하며, 검증 메모에 확인 여부를 명시한다.
 * 과학동아 원문 링크는 확인하지 못해 기사 ID만 표기한다 (URL을 추측해 만들지 않음).
 */

export interface VerifiedRef {
  title: string;
  publisher: string;
  date: string;
  url: string;
  note: string;
}

export interface CaseCard {
  card: number;
  title: string;
  category: string;
  article: { title: string; outlet: string; date: string; articleId: string; sheet: string };
  summary: string;
  spread: string;
  pdfClaims: string[];
  aiRole: string;
  /** 팩트체크 관점의 검증 메모 */
  verification: { status: "verified" | "partial" | "pdf_only"; text: string }[];
  refs: VerifiedRef[];
  sampleAd?: string;
  linkedTo?: number[];
}

const WONG_2019: VerifiedRef = {
  title: "Estimation of clinical trial success rates and related parameters",
  publisher: "Biostatistics (Wong CH, Siah KW, Lo AW)",
  date: "2019-04",
  url: "https://pubmed.ncbi.nlm.nih.gov/29394327/",
  note: "2000~2015년 임상시험 40만여 건 분석. 종양학(항암) 분야의 임상 성공률(1상→승인)을 3.4%로 추정하고, 연도별로 1.7%(2012)에서 8.3%(2015)까지 변동했다고 보고.",
};

const JAYATUNGA_2024: VerifiedRef = {
  title: "How successful are AI-discovered drugs in clinical trials? A first analysis and emerging lessons",
  publisher: "Drug Discovery Today (Jayatunga MKP 외)",
  date: "2024-06",
  url: "https://pubmed.ncbi.nlm.nih.gov/38692505/",
  note: "AI 기반 바이오텍의 파이프라인 분석. AI 발굴 분자의 1상 성공률 80~90%, 2상 약 40%(표본 적음)로 기존 업계 평균과 비슷하다고 보고. 최종 승인·치료 효과를 보여주는 자료는 아님.",
};

export const CASES: CaseCard[] = [
  {
    card: 18,
    title: "신약 개발 성공 확률",
    category: "항암제, 암치료",
    article: { title: "황유경 GC녹십자랩셀 세포치료연구소장 인터뷰", outlet: "과학동아", date: "2021.11", articleId: "S202111N040", sheet: "항암제, 암치료 · 순번 3" },
    summary:
      "항암 신약 개발은 무수한 실패 위에 이루어지지만, \"기적의 치료제\" 같은 과장 광고가 환자의 비현실적 기대를 만들어 검증 안 된 대체요법으로 흘러가게 만든다.",
    spread: "신약 임상 결과 보도 → \"암 완치\" 프레임 과장 → 검증 안 된 대체요법 광고로 연결",
    pdfClaims: [
      "항암 신약 개발 성공 확률: 0.02%",
      "황유경 소장이 31년째 도전 중",
      "동종세포치료제는 자가세포보다 부작용 위험 높음",
    ],
    aiRole: "환자 검색어 기반 알고리즘이 검증 안 된 대체요법 광고를 우선 노출 + 광고/의학정보 경계 모호화",
    verification: [
      {
        status: "pdf_only",
        text: "'0.02%'는 인터뷰 기사에서 인용된 수치로, 사례카드 PDF의 주장으로만 표시합니다. 원문 기사에서 이 값의 산출 기준(후보 물질 수 대비 출시 등)을 확인하지 못했습니다.",
      },
      {
        status: "partial",
        text: "'후보 물질 → 출시' 기준과 '임상 진입 후 → 승인' 기준은 서로 다른 지표입니다. 임상 진입 후 기준으로는 항암 분야 성공률이 약 3.4%로 추정된 연구가 있습니다(Wong 외, 2019). 두 수치를 같은 의미로 비교하면 안 됩니다.",
      },
      {
        status: "verified",
        text: "결론적으로 '신약 개발 성공 확률은 낮다'는 방향은 독립 연구와 일치하지만, 0.02%라는 특정 값을 모든 신약의 현재 일반 성공률로 단정할 수는 없습니다.",
      },
    ],
    refs: [WONG_2019],
    sampleAd: "31년 연구 끝에 탄생한 기적의 항암 치료제! 성공 확률 0.02%를 뚫은 신약으로 말기암도 완치됩니다.",
    linkedTo: [19],
  },
  {
    card: 19,
    title: "AI 신약 개발 트렌드",
    category: "항암제, 암치료",
    article: { title: "2023 신약 개발 키워드 30", outlet: "과학동아", date: "2023.09", articleId: "S202309N031", sheet: "항암제, 암치료 · 순번 5" },
    summary:
      "과학동아가 1년간 '신약' 키워드를 포함한 기사를 분석한 결과, AI가 최상위 트렌드 키워드로 등장했으나 임상 성공률은 여전히 낮아 기술-기대 간 괴리가 존재한다.",
    spread: "AI 신약 개발 뉴스 → \"AI가 암을 정복한다\" 프레임 → 투자 과열 + 환자 기대 비현실적 상승",
    pdfClaims: [
      "분석 대상 기사: 1만 2,083편 (2022.08~2023.08)",
      "유한양행·대웅제약 등 AI 전담 부서 설치",
      "AI 발굴 후보의 임상 성공률은 여전히 0.02% 수준 (카드 18 참조)",
    ],
    aiRole: "AI 기반 약물 후보 발굴 + 단백질 구조 예측이지만 미디어 보도는 임상 성공률 격차를 축소",
    verification: [
      {
        status: "partial",
        text: "카드의 'AI 발굴 후보의 임상 성공률은 여전히 0.02% 수준'이라는 문장은 카드 18의 인터뷰 수치(일반 신약 개발, 2021년)를 AI 신약에 그대로 옮겨 쓴 것으로 보입니다. AI 신약에 대한 0.02% 근거를 확인하지 못했으므로 이 연결은 'PDF의 주장'으로만 표시합니다.",
      },
      {
        status: "verified",
        text: "AI 발굴 분자의 초기 임상(1상) 성공률이 기존 평균보다 높고, 2상은 비슷하다는 분석이 있습니다(Jayatunga 외, 2024). 즉 'AI가 후보 물질 발굴을 돕는다'는 근거는 있지만, 최종 승인이나 치료 효과를 보장한다는 뜻은 아닙니다.",
      },
      {
        status: "pdf_only",
        text: "'1만 2,083편 분석'과 'AI 전담 부서 설치'는 과학동아 기사 내용을 요약한 카드의 주장이며, 본 서비스에서 원문을 별도로 확인하지 않았습니다.",
      },
    ],
    refs: [JAYATUNGA_2024, WONG_2019],
    sampleAd: "AI가 개발한 신약으로 모든 암을 100% 완치할 수 있습니다.",
    linkedTo: [18],
  },
  {
    card: 11,
    title: "비만치료제 위고비 (오남용 위험)",
    category: "다이어트, 비만치료제",
    article: { title: "'기적의 다이어트약' 출시, 이번엔 진짜 기적 맞아?", outlet: "과학동아", date: "2023.05", articleId: "S202305N013", sheet: "다이어트, 비만치료제 · 순번 40" },
    summary: "유명인들이 위고비를 '기적의 다이어트약'이라 부르며 품귀 현상이 발생했고, 부작용·반동 체중 증가 위험에 대한 정보는 가려졌다.",
    spread: "유명인 SNS 발언 → \"기적의 약\" 밈 확산 → 건강정보 채널 반복 보도 → 처방 없이 구매 시도 증가",
    pdfClaims: ["세계 비만치료제 시장: 2021년 32억 달러 → 2026년 46억 달러 예상", "위고비 임상에서 68주 후 체중 17.4% 감량 (투약 중단 시 반동)"],
    aiRole: "추천 알고리즘이 유명인 발언을 건강 관심 사용자에게 집중 노출",
    verification: [
      { status: "pdf_only", text: "시장 규모 전망치와 감량 수치는 카드 PDF의 주장으로 표시합니다. 감량 효과는 임상시험 조건(처방·생활습관 병행)에서의 평균값이며 개인차가 큽니다." },
    ],
    refs: [],
    sampleAd: "먹기만 하면 살 빠지는 기적의 다이어트약! 부작용 없이 한 달 만에 10kg 감량.",
  },
  {
    card: 12,
    title: "부당광고 단속 (크릴오일·타트체리)",
    category: "영양제, 건강식품",
    article: { title: "밥이 보약이 될 수 있다? 식품 광고 대해부", outlet: "과학동아", date: "2021.05", articleId: "S202105N018", sheet: "영양제, 건강식품 · 순번 1" },
    summary: "크릴오일·타트체리 등 건강식품이 소규모 연구를 근거로 과장된 효능을 광고하다 식약처에 대규모 적발됐다. 세포실험만으로 항바이러스 효과를 주장한 사례도 있었다.",
    spread: "소규모 연구 → 건강정보 프로그램 소개 → \"불면증 치료\" 등 부당광고 → SNS 입소문",
    pdfClaims: ["식약처 적발: 크릴오일 부당광고 829건(2020.04), 타트체리 138건(2020.08)", "타트체리 수면 효과 연구는 피험자 20명·11명의 소규모"],
    aiRole: "건강 키워드 검색 시 광고성 콘텐츠 상위 노출 + AI 타깃 마케팅",
    verification: [
      { status: "pdf_only", text: "적발 건수는 카드 PDF의 주장입니다. 이 사례는 '세포실험·소규모 연구 결과를 사람 대상 치료 효과로 확대 해석'하는 전형적 패턴을 보여줍니다." },
    ],
    refs: [],
    sampleAd: "타트체리 한 잔이면 불면증 치료! 임상으로 입증된 천연 수면제입니다.",
  },
  {
    card: 20,
    title: "비만치료제 시장 점유율 (구조적 의존)",
    category: "다이어트, 비만치료제",
    article: { title: "기적의 비만치료제, 당신은 선택할 건가요?", outlet: "과학동아", date: "2023.05", articleId: "S202305N014", sheet: "다이어트, 비만치료제 · 순번 41" },
    summary: "삭센다·위고비·마운자로 등 비만치료제가 '기적'으로 불리지만 실제로는 식욕 억제 기전이며, 투약 중단 시 반동·메스꺼움 등 부작용을 수반한다.",
    spread: "체중 감량 전후 사진 → 숏폼 콘텐츠 바이럴 → \"먹기만 하면 살 빠진다\" 메시지 확산",
    pdfClaims: ["한국 비만치료제 시장에서 삭센다가 4년 연속(2018~2022) 점유율 1위", "WHO 비만 기준: BMI 30 이상 (한국 기준 25 이상)"],
    aiRole: "숏폼 알고리즘이 전후 영상을 바이럴시켜 '기적' 서사 증폭",
    verification: [{ status: "pdf_only", text: "점유율 수치는 카드 PDF의 주장입니다." }],
    refs: [],
  },
];
