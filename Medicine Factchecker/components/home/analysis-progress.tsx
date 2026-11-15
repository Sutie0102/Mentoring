"use client";

import { motion } from "framer-motion";
import { CircleCheck, Circle, Loader2 } from "lucide-react";
import type { PipelineStep } from "@/lib/types";
import { cn } from "@/lib/utils";

export const STEP_LABELS: Record<PipelineStep, { title: string; desc: string }> = {
  collect: { title: "입력 수집", desc: "텍스트·OCR·음성 전사·PDF·URL 본문을 모읍니다" },
  extract: { title: "핵심 주장 추출", desc: "의학적 주장과 위험 표현을 원문 그대로 분리합니다" },
  search: { title: "근거 검색", desc: "PubMed·ClinicalTrials.gov·공공기관 자료를 실제로 조회합니다" },
  verify: { title: "주장 검증", desc: "검색된 출처만으로 각 주장을 판정합니다" },
  report: { title: "결과 생성", desc: "분류 비율·위험도·신뢰도를 계산합니다" },
};

export type StepState = Record<PipelineStep, { status: "pending" | "active" | "done"; detail?: string }>;

export function AnalysisProgress({ steps, logs }: { steps: StepState; logs: string[] }) {
  const order = Object.keys(STEP_LABELS) as PipelineStep[];
  const doneCount = order.filter((s) => steps[s].status === "done").length;
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto mt-6 max-w-3xl rounded-2xl border bg-card p-5 shadow-soft"
      aria-live="polite"
      aria-label="분석 진행 상황"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">AI 분석 진행 중</h2>
        <span className="text-sm text-muted-foreground">
          {doneCount} / {order.length} 단계
        </span>
      </div>
      <ol className="space-y-3">
        {order.map((s, i) => {
          const st = steps[s];
          return (
            <li key={s} className="flex gap-3">
              <span className="mt-0.5">
                {st.status === "done" ? (
                  <CircleCheck className="size-5 text-verdict-true" aria-label="완료" />
                ) : st.status === "active" ? (
                  <Loader2 className="size-5 animate-spin text-teal" aria-label="진행 중" />
                ) : (
                  <Circle className="size-5 text-muted-foreground/50" aria-label="대기" />
                )}
              </span>
              <div className={cn("min-w-0", st.status === "pending" && "opacity-60")}>
                <p className="text-sm font-medium">
                  {i + 1}. {STEP_LABELS[s].title}
                  {st.detail && <span className="ml-2 font-normal text-muted-foreground">— {st.detail}</span>}
                </p>
                <p className="text-xs text-muted-foreground">{STEP_LABELS[s].desc}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {logs.length > 0 && (
        <div className="mt-4 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          {logs.slice(-3).map((l, i) => (
            <p key={i}>› {l}</p>
          ))}
        </div>
      )}
    </motion.section>
  );
}
