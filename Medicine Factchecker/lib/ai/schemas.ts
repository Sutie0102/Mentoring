import { z } from "zod";

/** 1단계 — 주장 추출 응답 스키마 */
export const ExtractionSchema = z.object({
  isHealthContent: z.boolean().describe("의약품·건강 관련 광고/정보인지 여부"),
  visualNotes: z.string().describe("이미지·영상 프레임에서 확인한 시각적 요소(전후 사진, 가운 입은 인물, 인증 마크 등) 요약. 없으면 빈 문자열"),
  claims: z
    .array(
      z.object({
        segmentId: z.string().describe("주장이 등장한 입력 구간 ID (예: T1, I1-L3, V1-A2). 이미지 전체에서 시각적으로 확인한 경우 I1 처럼 미디어 ID"),
        originalText: z.string().describe("광고 원문 그대로 (수정·번역 금지)"),
        summary: z.string().describe("검증할 단일 주장을 한국어 한 문장으로"),
        entities: z.object({
          drugs: z.array(z.string()),
          ingredients: z.array(z.string()),
          diseases: z.array(z.string()),
          effects: z.array(z.string()),
          numbers: z.array(z.string()).describe("수치·확률 표현 원문"),
        }),
        riskPhrases: z.array(z.string()).describe("'100% 완치', '부작용 없음', '의사 추천', '임상 입증' 같은 위험 표현 원문"),
        pubmedQuery: z.string().describe("PubMed 검색용 영어 검색어 (MeSH 용어 우선, 3~6단어)"),
        trialsQuery: z.string().describe("ClinicalTrials.gov 검색용 영어 검색어 (약물/중재 + 질환). 해당 없으면 빈 문자열"),
      }),
    )
    .describe("검증 가능한 의학적 주장 목록, 최대 8개"),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

/** 3단계 — 주장 검증 응답 스키마 */
export const VerificationSchema = z.object({
  overallSummary: z.string().describe("광고 전체에 대한 종합 평가 (3~5문장, 한국어)"),
  consumerCautions: z.array(z.string()).describe("소비자 주의사항 3~5개"),
  claims: z.array(
    z.object({
      claimId: z.string(),
      verdict: z.enum(["TRUE", "EXAGGERATED", "FALSE", "UNVERIFIABLE"]),
      reasoning: z.string().describe("판정 이유"),
      supportingEvidence: z.string().describe("확인된(뒷받침) 근거 요약. 없으면 '확인된 근거 없음'"),
      counterEvidence: z.string().describe("반박 근거 요약. 없으면 '확인된 반박 근거 없음'"),
      scientificExplanation: z.string().describe("일반인을 위한 과학적 설명"),
      limitations: z.string().describe("근거·연구의 한계"),
      citations: z.array(
        z.object({
          sourceId: z.string().describe("제공된 출처 목록의 id만 사용"),
          stance: z.enum(["supports", "refutes", "context"]),
          relevance: z.string().describe("이 출처가 해당 주장과 어떻게 관련되는지"),
          limitation: z.string().describe("이 출처를 근거로 쓸 때의 한계"),
        }),
      ),
      harmPotential: z.enum(["low", "medium", "high"]).describe("이 주장을 믿었을 때 건강상 위해 가능성"),
      needsFurtherVerification: z.boolean(),
    }),
  ),
});
export type Verification = z.infer<typeof VerificationSchema>;
