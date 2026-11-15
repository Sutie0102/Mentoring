import type { ConfidenceLevel, RiskLevel, StudyType, Verdict } from "./types";

/** 업로드 제한 — Vercel 서버리스 요청 본문 한도(4.5MB)에 맞춘 값 */
export const LIMITS = {
  /** 서버로 전송되는 파일 합계 (이미지·PDF·영상 프레임) */
  maxUploadTotalBytes: 4 * 1024 * 1024,
  maxImageBytes: 4 * 1024 * 1024,
  maxPdfBytes: 4 * 1024 * 1024,
  /** 영상은 서버로 업로드하지 않고 브라우저에서 프레임만 추출 */
  maxVideoBytes: 200 * 1024 * 1024,
  maxVideoSeconds: 10 * 60,
  /** 음성 전사용 업로드 (OpenAI Whisper 한도 25MB, Vercel 배포 시 4MB) */
  maxTranscribeBytes: 24 * 1024 * 1024,
  maxImages: 4,
  maxPdfs: 2,
  maxVideos: 1,
  maxTextChars: 20000,
  maxClaims: 8,
  videoFrames: 8,
  urlMaxBytes: 2 * 1024 * 1024,
  urlTimeoutMs: 8000,
} as const;

export const ACCEPTED = {
  image: ["image/jpeg", "image/png", "image/webp"],
  video: ["video/mp4", "video/quicktime"],
  pdf: ["application/pdf"],
} as const;

export const ACCEPT_ATTR = ".jpg,.jpeg,.png,.webp,.mp4,.mov,.pdf,image/jpeg,image/png,image/webp,video/mp4,video/quicktime,application/pdf";

export const VERDICT_META: Record<
  Verdict,
  { label: string; short: string; description: string; color: string; darkColor: string; tw: { bg: string; text: string; border: string; dot: string } }
> = {
  TRUE: {
    label: "진실",
    short: "근거 있음",
    description: "신뢰할 수 있는 근거가 뒷받침하는 주장",
    color: "#15803d",
    darkColor: "#4ade80",
    tw: { bg: "bg-verdict-true/10", text: "text-verdict-true", border: "border-verdict-true/40", dot: "bg-verdict-true" },
  },
  EXAGGERATED: {
    label: "과장",
    short: "과장됨",
    description: "일부 사실에 기반하지만 과장된 주장",
    color: "#d97706",
    darkColor: "#f59e0b",
    tw: { bg: "bg-verdict-exag/10", text: "text-verdict-exag", border: "border-verdict-exag/40", dot: "bg-verdict-exag" },
  },
  FALSE: {
    label: "허위",
    short: "근거와 충돌",
    description: "신뢰할 수 있는 근거와 명확히 충돌하는 주장",
    color: "#dc2626",
    darkColor: "#ef4444",
    tw: { bg: "bg-verdict-false/10", text: "text-verdict-false", border: "border-verdict-false/40", dot: "bg-verdict-false" },
  },
  UNVERIFIABLE: {
    label: "판단 불가",
    short: "근거 부족",
    description: "근거가 부족하거나 검증할 수 없는 주장",
    color: "#64748b",
    darkColor: "#94a3b8",
    tw: { bg: "bg-verdict-unk/10", text: "text-verdict-unk", border: "border-verdict-unk/40", dot: "bg-verdict-unk" },
  },
};

export const RISK_META: Record<RiskLevel, { label: string; tw: string; description: string }> = {
  low: { label: "낮음", tw: "bg-verdict-true text-white", description: "의료 위해 가능성이 큰 허위·과장 주장이 발견되지 않았습니다." },
  caution: { label: "주의", tw: "bg-verdict-exag text-white", description: "과장되었거나 오해를 부를 수 있는 주장이 포함되어 있습니다." },
  high: { label: "높음", tw: "bg-verdict-false text-white", description: "건강에 해를 끼칠 수 있는 허위·과장 주장이 포함되어 있습니다." },
  pending: { label: "판단 보류", tw: "bg-verdict-unk text-white", description: "근거가 충분하지 않아 위험도를 판단하지 않았습니다." },
};

export const CONFIDENCE_META: Record<ConfidenceLevel, { label: string; tw: string }> = {
  high: { label: "높음", tw: "text-verdict-true" },
  medium: { label: "보통", tw: "text-verdict-exag" },
  low: { label: "낮음", tw: "text-verdict-unk" },
};

export const STUDY_TYPE_META: Record<StudyType, { label: string; weight: number; caution?: string }> = {
  systematic_review: { label: "체계적 문헌고찰·메타분석", weight: 1.0 },
  rct: { label: "무작위 대조시험", weight: 0.85 },
  regulatory: { label: "공식 기관 자료", weight: 0.8 },
  observational: { label: "관찰연구", weight: 0.55, caution: "인과관계를 단정할 수 없습니다." },
  expert_opinion: { label: "전문가 의견·리뷰", weight: 0.4 },
  trial_registry: { label: "임상시험 등록 정보", weight: 0.35, caution: "등록 정보는 시험이 진행·계획되었다는 뜻일 뿐, 효과가 입증되었다는 의미가 아닙니다." },
  animal: { label: "동물실험", weight: 0.25, caution: "동물실험 결과를 사람에 대한 치료 효과로 해석할 수 없습니다." },
  cell: { label: "세포실험", weight: 0.15, caution: "세포실험 결과를 사람에 대한 치료 효과로 해석할 수 없습니다." },
  other: { label: "유형 미분류", weight: 0.3 },
};

/** 의료 위해 가중치 (단순 개수 비율보다 위험한 허위 주장에 큰 가중치) */
export const HARM_WEIGHT = { low: 1, medium: 2, high: 3 } as const;

/** 공식 출처 검색 허용 도메인 */
export const OFFICIAL_DOMAINS = [
  "mfds.go.kr",
  "nedrug.mfds.go.kr",
  "foodsafetykorea.go.kr",
  "kdca.go.kr",
  "ncc.re.kr",
  "cancer.go.kr",
  "who.int",
  "nih.gov",
  "fda.gov",
  "ema.europa.eu",
];

export const DISCLAIMER =
  "MedFact AI는 의료 진단이나 처방을 제공하지 않습니다. 치료·복용 결정은 반드시 의사·약사와 상담하세요.";
