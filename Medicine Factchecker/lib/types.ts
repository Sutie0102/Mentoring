import { z } from "zod";

/** 4단계 판정 체계 */
export const VERDICTS = ["TRUE", "EXAGGERATED", "FALSE", "UNVERIFIABLE"] as const;
export const VerdictSchema = z.enum(VERDICTS);
export type Verdict = z.infer<typeof VerdictSchema>;

export const HARM_LEVELS = ["low", "medium", "high"] as const;
export type HarmLevel = (typeof HARM_LEVELS)[number];

export const STUDY_TYPES = [
  "systematic_review", // 체계적 문헌고찰·메타분석
  "rct", // 무작위 대조시험
  "observational", // 관찰연구
  "animal", // 동물실험
  "cell", // 세포실험
  "expert_opinion", // 전문가 의견·리뷰
  "regulatory", // 공식 기관 자료(허가·지침)
  "trial_registry", // 임상시험 등록 정보
  "other", // 분류 불가
] as const;
export type StudyType = (typeof STUDY_TYPES)[number];

export type SourceProvider = "pubmed" | "clinicaltrials" | "official_web" | "curated";

/** 실제 검색 결과에서만 생성되는 출처. 모델이 직접 만들지 않는다. */
export interface Source {
  id: string; // 예: "pubmed:29394327"
  provider: SourceProvider;
  title: string;
  publisher: string; // 저널·기관명
  date: string | null;
  url: string;
  studyType: StudyType;
  /** 연구 유형을 어떻게 판단했는지 (투명성) */
  studyTypeBasis: string;
  /** 모델이 읽은 요약/발췌 원문 (검색 결과에서 그대로) */
  snippet: string;
  /** 본문 발췌 없이 제목만 확인된 검색 결과 — 판정 근거로 쓸 수 없음(참고 전용) */
  titleOnly?: boolean;
}

export interface Citation {
  sourceId: string;
  stance: "supports" | "refutes" | "context";
  relevance: string;
  limitation: string;
}

export type ConfidenceLevel = "high" | "medium" | "low";

/** 광고 원문 속 위치 정보 */
export interface ClaimOrigin {
  kind: "text" | "image" | "video" | "pdf" | "url";
  label: string; // 사용자에게 보이는 위치 설명
  fileName?: string;
  /** 영상: 초 단위 */
  timestamp?: number;
  /** 이미지·프레임 OCR 상자 (원본 픽셀 기준) */
  bbox?: { x0: number; y0: number; x1: number; y1: number };
  imageWidth?: number;
  imageHeight?: number;
  mediaIndex?: number;
}

export interface ClaimResult {
  id: string;
  originalText: string; // 광고 원문 그대로
  summary: string; // 검증 대상 주장 요약
  entities: {
    drugs: string[];
    ingredients: string[];
    diseases: string[];
    effects: string[];
    numbers: string[];
  };
  riskPhrases: string[];
  verdict: Verdict;
  reasoning: string;
  supportingEvidence: string;
  counterEvidence: string;
  scientificExplanation: string;
  limitations: string;
  citations: Citation[];
  harmPotential: HarmLevel;
  needsFurtherVerification: boolean;
  confidence: { level: ConfidenceLevel; basis: string };
  /** 서버 후처리로 판정이 바뀐 경우 기록 */
  adjustments: string[];
  origin: ClaimOrigin | null;
}

export type AnalysisMode = "ai" | "demo" | "sample";

export interface VerdictRatio {
  TRUE: number;
  EXAGGERATED: number;
  FALSE: number;
  UNVERIFIABLE: number;
}

export type RiskLevel = "low" | "caution" | "high" | "pending";

export interface MediaRef {
  index: number;
  kind: "image" | "video" | "pdf";
  name: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface AnalysisResult {
  id: string;
  version: 1;
  mode: AnalysisMode;
  createdAt: string; // ISO
  inputSummary: {
    text: string;
    url: string | null;
    files: { name: string; kind: string; size: number }[];
  };
  overallSummary: string;
  consumerCautions: string[];
  claims: ClaimResult[];
  sources: Source[];
  ratio: VerdictRatio;
  risk: { level: RiskLevel; score: number | null; basis: string };
  analysisConfidence: { level: ConfidenceLevel; basis: string };
  searchLog: { provider: string; query: string; count: number; ok: boolean; note?: string }[];
  warnings: string[];
  media: MediaRef[];
  model: string | null;
}

/* ───────── 클라이언트 → 서버 요청 페이로드 ───────── */

export const OcrLineSchema = z.object({
  text: z.string().max(2000),
  bbox: z.object({ x0: z.number(), y0: z.number(), x1: z.number(), y1: z.number() }),
  confidence: z.number().min(0).max(100),
});
export type OcrLine = z.infer<typeof OcrLineSchema>;

export const ImageMetaSchema = z.object({
  name: z.string().max(200),
  width: z.number().int().positive().max(20000),
  height: z.number().int().positive().max(20000),
  ocrLines: z.array(OcrLineSchema).max(400),
  fileField: z.string().max(40).nullable(), // 업로드 파일 필드 이름 (비전 분석용)
});

export const VideoMetaSchema = z.object({
  name: z.string().max(200),
  duration: z.number().nonnegative().max(60 * 60 * 3),
  width: z.number().int().nonnegative().max(10000),
  height: z.number().int().nonnegative().max(10000),
  frames: z
    .array(
      z.object({
        time: z.number().nonnegative(),
        ocrLines: z.array(OcrLineSchema).max(200),
        fileField: z.string().max(40).nullable(),
      }),
    )
    .max(12),
  transcript: z
    .array(z.object({ start: z.number().nonnegative(), end: z.number().nonnegative(), text: z.string().max(4000) }))
    .max(1000)
    .nullable(),
});

export const AnalyzePayloadSchema = z.object({
  text: z.string().max(20000).default(""),
  url: z.string().max(2048).nullable().default(null),
  images: z.array(ImageMetaSchema).max(4).default([]),
  videos: z.array(VideoMetaSchema).max(1).default([]),
  pdfFields: z.array(z.object({ name: z.string().max(200), fileField: z.string().max(40) })).max(2).default([]),
});
export type AnalyzePayload = z.infer<typeof AnalyzePayloadSchema>;

/* ───────── 스트리밍 진행 이벤트 ───────── */

export const PIPELINE_STEPS = ["collect", "extract", "search", "verify", "report"] as const;
export type PipelineStep = (typeof PIPELINE_STEPS)[number];

export type ProgressEvent =
  | { type: "step"; step: PipelineStep; status: "start" | "done"; detail?: string }
  | { type: "log"; message: string }
  | { type: "result"; result: AnalysisResult }
  | { type: "error"; message: string; code?: string };
