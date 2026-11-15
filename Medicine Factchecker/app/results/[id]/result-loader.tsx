"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ResultView } from "@/components/result/result-view";
import { Button } from "@/components/ui/button";
import { getAnalysis } from "@/lib/client/history";
import { buildSampleResult } from "@/lib/data/sample";
import type { AnalysisResult } from "@/lib/types";

export function ResultLoader({ id }: { id: string }) {
  const [state, setState] = useState<{ loading: boolean; result: AnalysisResult | null }>({ loading: true, result: null });
  useEffect(() => {
    const r = getAnalysis(id) ?? (id === "sample-ai-drug" ? buildSampleResult() : null);
    setState({ loading: false, result: r });
  }, [id]);

  if (state.loading) {
    return (
      <div className="grid place-items-center py-32 text-muted-foreground" role="status">
        <Loader2 className="size-6 animate-spin" aria-hidden />
        <span className="sr-only">결과를 불러오는 중</span>
      </div>
    );
  }
  if (!state.result) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="text-xl font-semibold">결과를 찾을 수 없습니다</h1>
        <p className="mt-2 text-sm text-muted-foreground">분석 결과는 분석한 브라우저에만 저장됩니다. 기록이 삭제되었거나 다른 기기에서 열었을 수 있습니다.</p>
        <Button asChild className="mt-6">
          <Link href="/">새로 분석하기</Link>
        </Button>
      </div>
    );
  }
  return <ResultView result={state.result} />;
}
