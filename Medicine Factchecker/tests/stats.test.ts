import { describe, expect, it } from "vitest";
import { analysisConfidence, claimConfidence, computeRatio, computeRisk, enforceEvidenceRules } from "@/lib/stats";
import type { Citation, Source, Verdict } from "@/lib/types";

const src = (id: string, studyType: Source["studyType"]): Source => ({
  id, provider: "pubmed", title: id, publisher: "J", date: null, url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`, studyType, studyTypeBasis: "", snippet: "",
});
const cite = (sourceId: string, stance: Citation["stance"] = "supports"): Citation => ({ sourceId, stance, relevance: "", limitation: "" });

describe("computeRatio", () => {
  it("항상 합계 100", () => {
    const cases: Verdict[][] = [
      ["TRUE", "EXAGGERATED", "FALSE"],
      ["TRUE", "TRUE", "FALSE", "UNVERIFIABLE", "EXAGGERATED", "EXAGGERATED", "FALSE"],
      ["FALSE"],
      Array(7).fill("TRUE").concat(["FALSE", "UNVERIFIABLE"]) as Verdict[],
    ];
    for (const c of cases) {
      const r = computeRatio(c);
      expect(r.TRUE + r.EXAGGERATED + r.FALSE + r.UNVERIFIABLE).toBe(100);
    }
  });
  it("1/3씩이면 34/33/33", () => {
    const r = computeRatio(["TRUE", "EXAGGERATED", "FALSE"]);
    expect([r.TRUE, r.EXAGGERATED, r.FALSE].sort()).toEqual([33, 33, 34]);
  });
  it("주장이 없으면 판단 불가 100%", () => {
    expect(computeRatio([]).UNVERIFIABLE).toBe(100);
  });
});

describe("computeRisk", () => {
  it("위해 가능성 높은 허위 주장이 있으면 높음", () => {
    const r = computeRisk([
      { verdict: "TRUE", harmPotential: "low" },
      { verdict: "TRUE", harmPotential: "low" },
      { verdict: "TRUE", harmPotential: "low" },
      { verdict: "FALSE", harmPotential: "high" },
    ]);
    expect(r.level).toBe("high");
  });
  it("모두 판단 불가면 판단 보류", () => {
    expect(computeRisk([{ verdict: "UNVERIFIABLE", harmPotential: "high" }]).level).toBe("pending");
  });
  it("모두 진실이면 낮음", () => {
    expect(computeRisk([{ verdict: "TRUE", harmPotential: "medium" }]).level).toBe("low");
  });
  it("위해 가중치가 단순 개수보다 크게 반영된다", () => {
    const light = computeRisk([{ verdict: "TRUE", harmPotential: "low" }, { verdict: "EXAGGERATED", harmPotential: "low" }, { verdict: "TRUE", harmPotential: "low" }]);
    const heavy = computeRisk([{ verdict: "TRUE", harmPotential: "low" }, { verdict: "EXAGGERATED", harmPotential: "high" }, { verdict: "TRUE", harmPotential: "low" }]);
    expect(heavy.score!).toBeGreaterThan(light.score!);
  });
});

describe("enforceEvidenceRules", () => {
  const pool = new Map([["pubmed:1", src("pubmed:1", "rct")], ["pubmed:2", src("pubmed:2", "cell")]]);
  const base = { adjustments: [] as string[], needsFurtherVerification: false };

  it("출처 풀에 없는 인용은 제거", () => {
    const out = enforceEvidenceRules({ ...base, verdict: "TRUE" as Verdict, citations: [cite("pubmed:1"), cite("pubmed:999")] }, pool);
    expect(out.citations.map((c) => c.sourceId)).toEqual(["pubmed:1"]);
    expect(out.verdict).toBe("TRUE");
  });
  it("근거 없는 TRUE/FALSE는 판단 불가로 보류", () => {
    expect(enforceEvidenceRules({ ...base, verdict: "FALSE" as Verdict, citations: [cite("fake:1", "refutes")] }, pool).verdict).toBe("UNVERIFIABLE");
    expect(enforceEvidenceRules({ ...base, verdict: "TRUE" as Verdict, citations: [cite("pubmed:1", "context")] }, pool).verdict).toBe("UNVERIFIABLE");
  });
  it("세포실험만 근거인 TRUE는 과장으로 조정", () => {
    const out = enforceEvidenceRules({ ...base, verdict: "TRUE" as Verdict, citations: [cite("pubmed:2")] }, pool);
    expect(out.verdict).toBe("EXAGGERATED");
    expect(out.adjustments.length).toBeGreaterThan(0);
  });
  it("근거 없는 EXAGGERATED는 유지 (표현 자체의 과장)", () => {
    expect(enforceEvidenceRules({ ...base, verdict: "EXAGGERATED" as Verdict, citations: [] }, pool).verdict).toBe("EXAGGERATED");
  });
});

describe("confidence", () => {
  const pool = new Map([["a", src("a", "systematic_review")], ["b", src("b", "cell")]]);
  it("체계적 문헌고찰 근거는 높음", () => {
    expect(claimConfidence({ verdict: "FALSE", citations: [cite("a", "refutes")] }, pool).level).toBe("high");
  });
  it("세포실험 근거는 낮음", () => {
    expect(claimConfidence({ verdict: "EXAGGERATED", citations: [cite("b")] }, pool).level).toBe("low");
  });
  it("판단 불가는 낮음, 데모 모드 전체 신뢰도는 낮음", () => {
    expect(claimConfidence({ verdict: "UNVERIFIABLE", citations: [] }, pool).level).toBe("low");
    expect(analysisConfidence([{ verdict: "FALSE", citations: [cite("a", "refutes")] }], pool, "demo").level).toBe("low");
  });
});

describe("제목만 확인된 출처", () => {
  it("근거로 인정되지 않아 FALSE가 판단 불가로 보류된다", () => {
    const pool = new Map([["web:x", { ...src("web:x", "regulatory"), titleOnly: true }]]);
    const out = enforceEvidenceRules({ verdict: "FALSE" as Verdict, citations: [cite("web:x", "refutes")], adjustments: [], needsFurtherVerification: false }, pool);
    expect(out.citations[0].stance).toBe("context");
    expect(out.verdict).toBe("UNVERIFIABLE");
  });
});
