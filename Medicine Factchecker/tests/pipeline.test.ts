import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { chunkText } from "@/lib/pipeline";

describe("PDF 텍스트 묶음", () => {
  it("문장 중간 줄바꿈을 이어 붙이고 문단은 분리", () => {
    const out = chunkText("이 약은 모든 암을\n완치합니다. 부작용도\n없습니다.\n\n두 번째 문단입니다.");
    expect(out).toEqual(["이 약은 모든 암을 완치합니다. 부작용도 없습니다.", "두 번째 문단입니다."]);
  });
  it("긴 문단은 최대 길이로 나눈다", () => {
    const long = Array(40).fill("문장입니다.").join(" ");
    expect(chunkText(long, 100).every((c) => c.length <= 110)).toBe(true);
  });
});
