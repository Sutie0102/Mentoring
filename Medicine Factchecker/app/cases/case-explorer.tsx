"use client";

import { ArrowRight, BadgeCheck, CircleAlert, ExternalLink, FileQuestion, Link2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CASES, type CaseCard } from "@/lib/data/cases";
import { DATASET_B } from "@/lib/data/datasetB";
import { baselineClassify, detectRiskPhrases } from "@/lib/rules";
import { cn } from "@/lib/utils";

const STATUS = {
  verified: { icon: BadgeCheck, label: "독립 자료로 확인", cls: "text-verdict-true" },
  partial: { icon: CircleAlert, label: "부분 확인·주의", cls: "text-verdict-exag" },
  pdf_only: { icon: FileQuestion, label: "PDF의 주장 (미확인)", cls: "text-verdict-unk" },
};

function CaseCardView({ c, featured }: { c: CaseCard; featured?: boolean }) {
  return (
    <article id={`card-${c.card}`} className={cn("rounded-2xl border bg-card p-5 shadow-soft", featured && "border-teal/40")}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="teal">카드 {c.card}</Badge>
        <Badge variant="outline">{c.category}</Badge>
        {c.linkedTo?.map((l) => (
          <a key={l} href={`#card-${l}`} className="inline-flex items-center gap-1 text-xs text-teal hover:underline">
            <Link2 className="size-3" aria-hidden /> 카드 {l}과 연결
          </a>
        ))}
      </div>
      <h3 className="text-lg font-semibold">{c.title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {c.article.outlet} {c.article.date} · “{c.article.title}” · 기사 ID {c.article.articleId} · 시트 {c.article.sheet}
      </p>
      <p className="mt-3 text-sm leading-relaxed">{c.summary}</p>
      <p className="mt-2 text-xs text-muted-foreground">확산 경로: {c.spread}</p>
      <p className="mt-1 text-xs text-muted-foreground">AI 관여 방식: {c.aiRole}</p>

      <div className="mt-4 rounded-xl bg-muted/50 p-3">
        <p className="mb-1 text-xs font-semibold text-muted-foreground">카드에 실린 수치 (PDF의 주장)</p>
        <ul className="list-disc space-y-0.5 pl-4 text-sm">
          {c.pdfClaims.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">팩트체크 메모</p>
        {c.verification.map((v) => {
          const s = STATUS[v.status];
          return (
            <div key={v.text} className="flex gap-2 text-sm">
              <s.icon className={cn("mt-0.5 size-4 shrink-0", s.cls)} aria-hidden />
              <p>
                <span className={cn("mr-1 text-xs font-semibold", s.cls)}>[{s.label}]</span>
                {v.text}
              </p>
            </div>
          );
        })}
      </div>

      {c.refs.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">독립 확인 자료 (PubMed에서 존재 확인)</p>
          {c.refs.map((r) => (
            <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl border p-3 text-sm hover:border-teal/50">
              <span className="flex items-start justify-between gap-2 font-medium">
                {r.title} <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-teal" aria-hidden />
              </span>
              <span className="block text-xs text-muted-foreground">
                {r.publisher} · {r.date}
              </span>
              <span className="mt-1 block text-xs">{r.note}</span>
            </a>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">과학동아 원문 링크는 확인하지 못해 기사 ID만 표기합니다.</p>

      {c.sampleAd && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed p-3">
          <p className="text-sm">
            <span className="text-xs text-muted-foreground">이 사례를 응용한 가상 광고: </span>“{c.sampleAd}”
          </p>
          <Button size="sm" variant="accent" asChild>
            <Link href={`/?text=${encodeURIComponent(c.sampleAd)}`}>
              분석해 보기 <ArrowRight />
            </Link>
          </Button>
        </div>
      )}
    </article>
  );
}

function DatasetExperiment() {
  const [filter, setFilter] = useState<"all" | "0" | "1" | "wrong">("all");
  const rows = useMemo(() => DATASET_B.map((r) => ({ ...r, pred: baselineClassify(r.text), hits: detectRiskPhrases(r.text) })), []);
  const tp = rows.filter((r) => r.label === 1 && r.pred === 1).length;
  const tn = rows.filter((r) => r.label === 0 && r.pred === 0).length;
  const fp = rows.filter((r) => r.label === 0 && r.pred === 1).length;
  const fn = rows.filter((r) => r.label === 1 && r.pred === 0).length;
  const acc = (tp + tn) / rows.length;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const shown = rows.filter((r) => (filter === "all" ? true : filter === "wrong" ? r.label !== r.pred : String(r.label) === filter));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-verdict-exag/40 bg-verdict-exag/10 p-4 text-sm">
        <p className="font-semibold">데이터 해석 시 주의</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
          <li>label은 원 작성자가 부여한 분류값이며, 독립적으로 검증된 의학적 진실이 아닙니다.</li>
          <li>이진 분류(0 정상 / 1 허위·과장)는 이 서비스의 4단계 판정(진실·과장·허위·판단 불가)과 다른 체계입니다. label 1을 '허위'로, label 0을 '진실'로 바로 옮길 수 없습니다.</li>
          <li>label 0 문장 중에도 '0.02%'처럼 특정 자료의 수치를 일반화한 문장이 있어, 실제 서비스에서는 별도 검증이 필요합니다.</li>
        </ul>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <h3 className="font-semibold">기준선 분류기: 위험 표현 규칙</h3>
          <p className="mt-1 text-sm text-muted-foreground">위험 표현(100% 완치, 부작용 없음, 치료 중단 권유 등) 규칙이 하나라도 걸리면 1로 예측합니다. 서비스의 데모 모드와 같은 규칙입니다.</p>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              ["정확도", acc],
              ["정밀도", precision],
              ["재현율", recall],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-xl bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="text-xl font-bold tabular-nums">{((v as number) * 100).toFixed(0)}%</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">문장 {rows.length}개 (label 1: {rows.filter((r) => r.label === 1).length}, label 0: {rows.filter((r) => r.label === 0).length}) · 학습 없이 규칙만 적용한 결과</p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <h3 className="font-semibold">혼동 행렬</h3>
          <table className="mt-3 w-full table-fixed text-center text-sm">
            <caption className="sr-only">실제 label과 규칙 예측의 혼동 행렬</caption>
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="p-2" />
                <th className="p-2 font-medium">예측 0</th>
                <th className="p-2 font-medium">예측 1</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th className="p-2 text-xs font-medium text-muted-foreground">실제 0</th>
                <td className="rounded-tl-xl bg-teal/15 p-3 text-lg font-semibold tabular-nums">{tn}</td>
                <td className="rounded-tr-xl bg-muted p-3 text-lg font-semibold tabular-nums">{fp}</td>
              </tr>
              <tr>
                <th className="p-2 text-xs font-medium text-muted-foreground">실제 1</th>
                <td className="rounded-bl-xl bg-muted p-3 text-lg font-semibold tabular-nums">{fn}</td>
                <td className="rounded-br-xl bg-teal/15 p-3 text-lg font-semibold tabular-nums">{tp}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">놓친 문장(실제 1, 예측 0)은 광고 문구를 직접 인용하지 않고 '검증 안 된 요법이 공유되고 있다', '가짜 뉴스가 퍼지고 있다'처럼 상황을 서술하는 문장입니다. 문맥을 이해하지 못하는 규칙의 한계입니다.</p>
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="문장 필터">
          {(
            [
              ["all", "전체"],
              ["1", "label 1"],
              ["0", "label 0"],
              ["wrong", "예측 불일치"],
            ] as const
          ).map(([k, l]) => (
            <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)} aria-pressed={filter === k}>
              {l}
            </Button>
          ))}
        </div>
        <ul className="divide-y rounded-2xl border bg-card">
          {shown.map((r) => (
            <li key={r.text} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <p className="text-sm">{r.text}</p>
                {r.hits.length > 0 && <p className="mt-1 text-xs text-verdict-exag">탐지: {r.hits.map((h) => h.rule.label).join(", ")}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs">
                <span className="rounded-full border px-2 py-0.5">label {r.label}</span>
                <span className={cn("rounded-full px-2 py-0.5", r.pred === r.label ? "bg-teal/15 text-teal" : "bg-verdict-false/15 text-verdict-false")}>예측 {r.pred}</span>
                <Link href={`/?text=${encodeURIComponent(r.text)}`} className="text-teal hover:underline">
                  분석
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function CaseExplorer() {
  const [tab, setTab] = useState<"cards" | "dataset">("cards");
  const featured = CASES.filter((c) => c.card === 18 || c.card === 19);
  const others = CASES.filter((c) => c.card !== 18 && c.card !== 19);
  return (
    <div className="mt-6">
      <div role="tablist" aria-label="사례 탐색 보기" className="mb-6 inline-flex rounded-xl border bg-card p-1 shadow-soft">
        {(
          [
            ["cards", "사례 카드"],
            ["dataset", "데이터셋 실험"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn("rounded-lg px-4 py-2 text-sm font-medium", tab === k ? "bg-navy text-white dark:bg-teal dark:text-[#04231f]" : "text-muted-foreground hover:text-foreground")}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "cards" ? (
        <div className="space-y-8">
          <section aria-labelledby="featured-title">
            <h2 id="featured-title" className="text-lg font-semibold">
              AI 신약 개발: 기대와 실제 임상 성공 사이
            </h2>
            <p className="mt-1 mb-4 max-w-3xl text-sm text-muted-foreground">
              카드 19(AI 신약 트렌드)는 카드 18(신약 개발 성공 확률)의 0.02% 수치를 AI 신약에 연결합니다. 그러나 두 수치는 시점과 대상이 달라 그대로 이어 붙일 수 없습니다. 'AI로 후보 물질을 찾는 것'과 '승인된 약이 실제로 치료 효과를 내는 것'은 다른 단계입니다.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {featured.map((c) => (
                <CaseCardView key={c.card} c={c} featured />
              ))}
            </div>
          </section>
          <section aria-labelledby="other-title">
            <h2 id="other-title" className="mb-4 text-lg font-semibold">
              관련 건강정보 사례
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {others.map((c) => (
                <CaseCardView key={c.card} c={c} />
              ))}
            </div>
          </section>
        </div>
      ) : (
        <DatasetExperiment />
      )}
    </div>
  );
}
