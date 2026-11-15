import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { toStrictJsonSchema } from "@/lib/ai/client";
import { ExtractionSchema, VerificationSchema } from "@/lib/ai/schemas";
import { buildSampleResult } from "@/lib/data/sample";
import { DATASET_B } from "@/lib/data/datasetB";
import { htmlToParagraphs } from "@/lib/extract/html";
import { baselineClassify, buildEnglishQuery, detectRiskPhrases } from "@/lib/rules";
import { classifyPubmed } from "@/lib/sources/studyType";

describe("위험 표현 탐지", () => {
  it("예시 광고에서 핵심 위험 표현을 찾는다", () => {
    const ids = detectRiskPhrases("AI가 개발한 신약으로 모든 암을 100% 완치할 수 있습니다.").map((h) => h.rule.id);
    expect(ids).toEqual(expect.arrayContaining(["percent_cure", "all_disease", "complete_cure"]));
  });
  it("부작용 없음 / 의사 추천 / 치료 중단", () => {
    expect(detectRiskPhrases("부작용 없이 효과").map((h) => h.rule.id)).toContain("no_side_effect");
    expect(detectRiskPhrases("부작용이 전혀 없습니다").map((h) => h.rule.id)).toContain("no_side_effect");
    expect(detectRiskPhrases("의사들이 추천하는 제품").map((h) => h.rule.id)).toContain("doctor_endorse");
    expect(detectRiskPhrases("항암제 없이도 치료 가능").map((h) => h.rule.id)).toContain("replace_treatment");
  });
  it("중립 문장에는 반응하지 않는다", () => {
    expect(detectRiskPhrases("국립암센터가 국가 암 검진 가이드라인 개정안을 검토 중이다.").length).toBe(0);
  });
  it("영어 검색어 생성", () => {
    expect(buildEnglishQuery("AI가 개발한 신약으로 모든 암을 완치")).toContain("cancer");
  });
});

describe("데이터셋 B", () => {
  it("40문장, label 균형 20/20", () => {
    expect(DATASET_B.length).toBe(40);
    expect(DATASET_B.filter((r) => r.label === 1).length).toBe(20);
  });
  it("기준선 분류기 결과를 계산할 수 있다", () => {
    const correct = DATASET_B.filter((r) => baselineClassify(r.text) === r.label).length;
    expect(correct).toBeGreaterThan(20); // 무작위(50%)보다 나아야 함
  });
});

describe("연구 유형 분류", () => {
  it("출판 유형 우선", () => {
    expect(classifyPubmed(["Meta-Analysis"], "x", "").type).toBe("systematic_review");
    expect(classifyPubmed(["Randomized Controlled Trial"], "x", "").type).toBe("rct");
  });
  it("세포·동물실험 키워드", () => {
    expect(classifyPubmed(["Journal Article"], "Effect of X on HeLa cell line in vitro", "").type).toBe("cell");
    expect(classifyPubmed(["Journal Article"], "X reduces tumor growth in mice", "").type).toBe("animal");
    expect(classifyPubmed(["Journal Article"], "X in mice and patients", "").type).not.toBe("animal");
  });
});

describe("구조화 출력 스키마", () => {
  it("모든 객체가 닫혀 있고 모든 속성이 required", () => {
    for (const s of [ExtractionSchema, VerificationSchema]) {
      const walk = (n: any) => {
        if (!n || typeof n !== "object") return;
        if (n.type === "object") {
          expect(n.additionalProperties).toBe(false);
          expect(new Set(n.required)).toEqual(new Set(Object.keys(n.properties)));
        }
        Object.values(n).forEach(walk);
      };
      walk(toStrictJsonSchema(s));
    }
  });
});

describe("HTML 본문 추출", () => {
  it("스크립트·스타일 제거, 엔티티 해석", () => {
    const r = htmlToParagraphs(`<html><head><title>광고 &amp; 이벤트</title><script>evil()</script></head><body><nav>메뉴메뉴메뉴</nav><p>이 약은 모든 암을 완치합니다&#33;</p><style>.a{}</style></body></html>`);
    expect(r.title).toBe("광고 & 이벤트");
    expect(r.paragraphs.join(" ")).toContain("모든 암을 완치합니다!");
    expect(r.paragraphs.join(" ")).not.toContain("evil");
    expect(r.paragraphs.join(" ")).not.toContain("메뉴");
  });
});

describe("샘플 결과", () => {
  it("요구된 3색 예시(진실·과장·허위)를 재현하고 비율 합계 100", () => {
    const r = buildSampleResult();
    expect(r.claims.map((c) => c.verdict)).toEqual(["TRUE", "EXAGGERATED", "FALSE"]);
    expect(Object.values(r.ratio).reduce((a, b) => a + b, 0)).toBe(100);
    expect(r.risk.level).toBe("high");
    const ids = new Set(r.sources.map((s) => s.id));
    r.claims.forEach((c) => c.citations.forEach((x) => expect(ids.has(x.sourceId)).toBe(true)));
  });
});

describe("치료 대체 주장 탐지", () => {
  it("항암제를 쓸 필요 없이 / ~만으로 림프종 치료", () => {
    expect(detectRiskPhrases("항암제를 쓸 필요 없이 암 세포가 사멸").map((h) => h.rule.id)).toContain("replace_treatment");
    expect(detectRiskPhrases("소금물 단식만으로 림프종을 치료할 수 있다").map((h) => h.rule.id)).toContain("sole_remedy");
  });
});

describe("문맥 오탐 방지", () => {
  it("'투약 중단'은 치료 중단 권유가 아니다", () => {
    expect(detectRiskPhrases("투약 중단 시 반동 체중 증가").map((h) => h.rule.id)).not.toContain("replace_treatment");
    expect(detectRiskPhrases("약을 끊고 이것만 드세요").map((h) => h.rule.id)).toContain("replace_treatment");
  });
  it("HTML 소스 줄바꿈으로 문장이 잘리지 않는다", () => {
    const r = htmlToParagraphs("<body><p>Nearly a quarter of deaths\r\n from cancer are due to tobacco.</p></body>");
    expect(r.paragraphs).toEqual(["Nearly a quarter of deaths from cancer are due to tobacco."]);
  });
});
