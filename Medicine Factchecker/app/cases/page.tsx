import type { Metadata } from "next";
import { CaseExplorer } from "./case-explorer";

export const metadata: Metadata = { title: "사례 탐색" };

export default function CasesPage() {
  return (
    <div className="pt-10">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">사례 탐색</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        과학동아 기사를 바탕으로 만든 건강정보 사례 카드와, 항암 관련 문장 데이터셋을 이용한 분류 실험을 살펴봅니다. 카드의 수치는 원 자료의 주장이며, 확인 여부를 함께 표시합니다.
      </p>
      <CaseExplorer />
    </div>
  );
}
