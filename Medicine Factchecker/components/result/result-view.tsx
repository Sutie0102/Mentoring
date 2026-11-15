"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Bot, CalendarClock, FlaskConical, Info, Search, ShieldAlert, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { deleteAnalysis } from "@/lib/client/history";
import { dropSessionMedia, getSessionMedia } from "@/lib/client/media";
import { CONFIDENCE_META, DISCLAIMER, RISK_META } from "@/lib/constants";
import type { AnalysisResult, Verdict } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { ClaimCard } from "./claim-card";
import { ImageWithBoxes, MediaUnavailable, VideoPlayer } from "./media-panel";
import { SourceCard } from "./source-card";
import { VerdictBars, VerdictDonut } from "./verdict-chart";

const MODE_BANNER = {
  ai: null,
  demo: {
    icon: FlaskConical,
    title: "데모(규칙 기반) 결과",
    text: "AI 검증 없이 규칙으로 위험 표현만 탐지한 결과입니다. 진실·허위 판정은 수행되지 않았으며, 검색된 문헌은 내용 검토 전 참고 자료입니다.",
  },
  sample: {
    icon: Sparkles,
    title: "샘플 결과",
    text: "서비스 시연을 위해 작성된 예시이며 실제 AI 분석 결과가 아닙니다. 인용된 출처는 실제로 존재하는 자료입니다.",
  },
};

export function ResultView({ result }: { result: AnalysisResult }) {
  const router = useRouter();
  const sources = useMemo(() => new Map(result.sources.map((s) => [s.id, s])), [result.sources]);
  const counts = useMemo(() => {
    const c = { TRUE: 0, EXAGGERATED: 0, FALSE: 0, UNVERIFIABLE: 0 } as Record<Verdict, number>;
    result.claims.forEach((x) => c[x.verdict]++);
    return c;
  }, [result.claims]);
  const sessionMedia = getSessionMedia(result.id);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeClaim, setActiveClaim] = useState<string | null>(null);
  const banner = MODE_BANNER[result.mode];
  const risk = RISK_META[result.risk.level];
  const conf = CONFIDENCE_META[result.analysisConfidence.level];
  // 광고 원문 흐름 그대로 (추출 순서) 표시
  const sortedClaims = result.claims;
  const hasVideo = sessionMedia.some((m) => m.kind === "video");

  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = t;
    v.scrollIntoView({ behavior: "smooth", block: "center" });
    void v.play().catch(() => undefined);
  };
  const locate = (id: string) => {
    setActiveClaim(id);
    document.getElementById(`media-panel`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const selectFromMedia = (id: string) => {
    setActiveClaim(id);
    document.getElementById(`claim-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const remove = () => {
    if (!confirm("이 분석 기록을 삭제할까요? 삭제 후에는 복구할 수 없습니다.")) return;
    deleteAnalysis(result.id);
    dropSessionMedia(result.id);
    router.push("/history");
  };

  return (
    <div className="pt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">분석 결과</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-4" aria-hidden /> 분석 시점 {formatDate(result.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Bot className="size-4" aria-hidden /> {result.mode === "ai" ? `AI 검증 (${result.model})` : result.mode === "demo" ? "규칙 기반 데모" : "샘플"}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/">새 분석</Link>
          </Button>
          <Button variant="ghost" onClick={remove} aria-label="이 분석 기록 삭제">
            <Trash2 /> 삭제
          </Button>
        </div>
      </div>

      {banner && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border-2 border-dashed border-verdict-exag/60 bg-verdict-exag/10 p-4">
          <banner.icon className="mt-0.5 size-5 shrink-0 text-verdict-exag" aria-hidden />
          <div>
            <p className="font-semibold">{banner.title}</p>
            <p className="text-sm text-muted-foreground">{banner.text}</p>
          </div>
        </div>
      )}

      {result.warnings.length > 0 && (
        <ul className="mb-6 space-y-1 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
          {result.warnings.map((w) => (
            <li key={w} className="flex items-start gap-2">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {w}
            </li>
          ))}
        </ul>
      )}

      {/* 종합 판정 */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardDescription>입력한 광고</CardDescription>
            <p className="line-clamp-3 text-base font-medium">{result.inputSummary.text || result.inputSummary.url || result.media.map((m) => m.name).join(", ") || "(첨부 자료)"}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-3 rounded-xl border p-3">
                <ShieldAlert className="size-6 text-muted-foreground" aria-hidden />
                <div>
                  <p className="text-xs text-muted-foreground">종합 위험도</p>
                  <p>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-sm font-semibold", risk.tw)}>{risk.label}</span>
                    {result.risk.score !== null && <span className="ml-2 text-xs text-muted-foreground tabular-nums">위해 가중 점수 {result.risk.score}/100</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border p-3">
                <Search className="size-6 text-muted-foreground" aria-hidden />
                <div>
                  <p className="text-xs text-muted-foreground">분석 신뢰도 (주장 판정과 별개)</p>
                  <p className={cn("text-sm font-semibold", conf.tw)}>{conf.label}</p>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{risk.description} {result.risk.basis}.</p>
            <div>
              <h2 className="mb-1 font-semibold">종합 평가</h2>
              <p className="text-sm leading-relaxed">{result.overallSummary}</p>
            </div>
            <p className="text-xs text-muted-foreground">신뢰도 산출: {result.analysisConfidence.basis}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>주장 분류 비율</CardTitle>
            <CardDescription>추출된 주장 중 각 판정이 차지하는 비율입니다. 광고가 진실일 확률이 아닙니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <VerdictDonut ratio={result.ratio} counts={counts} />
            <VerdictBars ratio={result.ratio} counts={counts} />
          </CardContent>
        </Card>
      </motion.div>

      {/* 미디어 */}
      {result.media.some((m) => m.kind !== "pdf") && (
        <section id="media-panel" className="mt-8" aria-label="분석한 미디어">
          <h2 className="mb-3 text-lg font-semibold">분석한 미디어</h2>
          {sessionMedia.length === 0 ? (
            <MediaUnavailable media={result.media.filter((m) => m.kind !== "pdf")} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {result.media.map((m) => {
                const sm = sessionMedia.find((x) => x.index === m.index);
                if (!sm) return null;
                if (m.kind === "image") return <ImageWithBoxes key={m.index} media={m} url={sm.url} claims={result.claims} activeId={activeClaim} onSelect={selectFromMedia} />;
                if (m.kind === "video") return <VideoPlayer key={m.index} ref={videoRef} media={m} url={sm.url} />;
                return null;
              })}
            </div>
          )}
        </section>
      )}

      {/* 문구별 평가 */}
      <section className="mt-8" aria-label="문구별 평가">
        <h2 className="mb-3 text-lg font-semibold">문구별 평가 ({result.claims.length})</h2>
        {result.claims.length === 0 ? (
          <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">검증할 의학적 주장을 찾지 못했습니다.</p>
        ) : (
          <div className="space-y-3">
            {sortedClaims.map((c, i) => (
              <ClaimCard
                key={c.id}
                claim={c}
                sources={sources}
                active={activeClaim === c.id}
                onSeek={hasVideo ? seek : undefined}
                onLocate={sessionMedia.some((m) => m.kind === "image" || m.kind === "video") ? locate : undefined}
                defaultOpen={i === 0}
              />
            ))}
          </div>
        )}
      </section>

      {/* 소비자 주의사항 */}
      {result.consumerCautions.length > 0 && (
        <section className="mt-8 rounded-2xl border bg-card p-5 shadow-soft" aria-label="소비자 주의사항">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <AlertTriangle className="size-5 text-verdict-exag" aria-hidden /> 소비자 주의사항
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {result.consumerCautions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">{DISCLAIMER}</p>
        </section>
      )}

      {/* 참고 자료 */}
      <section className="mt-8" aria-label="참고 자료">
        <h2 className="mb-3 text-lg font-semibold">참고 자료 ({result.sources.length})</h2>
        {result.sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">인용된 출처가 없습니다.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {result.sources.map((s) => (
              <SourceCard key={s.id} source={s} />
            ))}
          </div>
        )}
        <details className="mt-4 rounded-xl border p-4 text-sm">
          <summary className="cursor-pointer font-medium">검색 기록 ({result.searchLog.length})</summary>
          <table className="mt-3 w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 pr-2 font-medium">출처</th>
                <th className="py-1 pr-2 font-medium">검색어</th>
                <th className="py-1 pr-2 font-medium">결과</th>
              </tr>
            </thead>
            <tbody>
              {result.searchLog.map((l, i) => (
                <tr key={i} className="border-t align-top">
                  <td className="py-1.5 pr-2">{l.provider}</td>
                  <td className="py-1.5 pr-2 break-all">{l.query}</td>
                  <td className="py-1.5 pr-2">
                    {l.ok ? `${l.count}건` : "실패"}
                    {l.note && <span className="block text-muted-foreground">{l.note}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
    </div>
  );
}
