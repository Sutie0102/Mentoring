"use client";

import { FileSearch, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { VerdictIcon } from "@/components/verdict-icon";
import { clearHistory, deleteAnalysis, loadHistory } from "@/lib/client/history";
import { dropSessionMedia } from "@/lib/client/media";
import { RISK_META, VERDICT_META } from "@/lib/constants";
import type { AnalysisResult } from "@/lib/types";
import { VERDICTS } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

const MODE_LABEL = { ai: "AI 검증", demo: "데모", sample: "샘플" } as const;

export default function HistoryPage() {
  const [items, setItems] = useState<AnalysisResult[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => setItems(loadHistory()), []);

  const filtered = useMemo(() => {
    if (!items) return [];
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((a) =>
      [a.inputSummary.text, a.inputSummary.url ?? "", a.overallSummary, ...a.claims.map((c) => c.originalText), ...a.media.map((m) => m.name)].join(" ").toLowerCase().includes(s),
    );
  }, [items, q]);

  const remove = (id: string) => {
    deleteAnalysis(id);
    dropSessionMedia(id);
    setItems(loadHistory());
  };
  const removeAll = () => {
    if (!confirm("모든 분석 기록을 삭제할까요? 삭제 후에는 복구할 수 없습니다.")) return;
    clearHistory();
    dropSessionMedia();
    setItems([]);
  };

  return (
    <div className="pt-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">분석 기록</h1>
          <p className="mt-1 text-sm text-muted-foreground">기록은 이 브라우저에만 저장되며 서버로 전송되지 않습니다. 최근 30개까지 보관합니다.</p>
        </div>
        {items && items.length > 0 && (
          <Button variant="outline" onClick={removeAll}>
            <Trash2 /> 전체 삭제
          </Button>
        )}
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl border bg-card px-3 shadow-soft">
        <Search className="size-4 text-muted-foreground" aria-hidden />
        <label htmlFor="history-search" className="sr-only">
          기록 검색
        </label>
        <input id="history-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="광고 문구, 주장, 파일명으로 검색" className="h-11 w-full bg-transparent text-sm outline-none" />
      </div>

      {items === null ? null : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-16 text-center">
          <FileSearch className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">{items.length === 0 ? "아직 분석 기록이 없습니다" : "검색 결과가 없습니다"}</p>
          {items.length === 0 && (
            <Button asChild className="mt-4">
              <Link href="/">첫 분석 시작하기</Link>
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((a) => {
            const risk = RISK_META[a.risk.level];
            return (
              <li key={a.id} className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-soft">
                <Link href={`/results/${a.id}`} className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className={cn("rounded-full px-2 py-0.5 font-semibold", risk.tw)}>위험도 {risk.label}</span>
                    <span className="rounded-full border px-2 py-0.5">{MODE_LABEL[a.mode]}</span>
                    <span>{formatDate(a.createdAt)}</span>
                  </div>
                  <p className="line-clamp-2 font-medium hover:text-teal">{a.inputSummary.text || a.inputSummary.url || a.media.map((m) => m.name).join(", ") || "(첨부 자료)"}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    {VERDICTS.map((v) => {
                      const n = a.claims.filter((c) => c.verdict === v).length;
                      if (!n) return null;
                      return (
                        <span key={v} className={cn("inline-flex items-center gap-1", VERDICT_META[v].tw.text)}>
                          <VerdictIcon verdict={v} className="size-3.5" /> {VERDICT_META[v].label} {n}
                        </span>
                      );
                    })}
                  </div>
                </Link>
                <Button variant="ghost" size="icon" onClick={() => remove(a.id)} aria-label="이 기록 삭제">
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
