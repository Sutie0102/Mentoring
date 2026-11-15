"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Clock, MapPin, ScanSearch, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { CONFIDENCE_META, VERDICT_META } from "@/lib/constants";
import type { ClaimResult, Source } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { VerdictIcon } from "../verdict-icon";
import { SourceCard } from "./source-card";

const HARM_LABEL = { low: "낮음", medium: "중간", high: "높음" } as const;

/** 원문 속 위험 표현을 강조 */
function Highlighted({ text, phrases }: { text: string; phrases: string[] }) {
  const ps = phrases.filter((p) => p && text.includes(p)).sort((a, b) => b.length - a.length);
  if (ps.length === 0) return <>{text}</>;
  const re = new RegExp(`(${ps.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return (
    <>
      {text.split(re).map((part, i) =>
        ps.includes(part) ? (
          <mark key={i} className="rounded bg-verdict-false/15 px-0.5 text-inherit underline decoration-verdict-false decoration-2 underline-offset-2">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export function ClaimCard({
  claim,
  sources,
  active,
  onSeek,
  onLocate,
  defaultOpen = false,
}: {
  claim: ClaimResult;
  sources: Map<string, Source>;
  active?: boolean;
  onSeek?: (t: number) => void;
  onLocate?: (id: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const m = VERDICT_META[claim.verdict];
  const o = claim.origin;
  const conf = CONFIDENCE_META[claim.confidence.level];

  return (
    <article id={`claim-${claim.id}`} className={cn("overflow-hidden rounded-2xl border bg-card shadow-soft transition-shadow", active && "ring-2 ring-teal")}>
      <div className={cn("flex border-l-4", m.tw.border.replace("/40", ""))} style={{ borderLeftColor: m.color }}>
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", m.tw.bg, m.tw.text)}>
              <VerdictIcon verdict={claim.verdict} className="size-3.5" />
              {m.label}
            </span>
            <span className="text-xs text-muted-foreground">{claim.id}</span>
            {o?.timestamp !== undefined && (
              <button
                type="button"
                onClick={() => onSeek?.(o.timestamp!)}
                disabled={!onSeek}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent"
                aria-label={`영상 ${formatTime(o.timestamp)} 지점${onSeek ? "으로 이동" : ""}`}
              >
                <Clock className="size-3" aria-hidden /> {formatTime(o.timestamp)}
              </button>
            )}
            {o?.bbox && (
              <button type="button" onClick={() => onLocate?.(claim.id)} disabled={!onLocate} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted disabled:cursor-default">
                <ScanSearch className="size-3" aria-hidden /> 위치 ({Math.round(o.bbox.x0)}, {Math.round(o.bbox.y0)})
              </button>
            )}
            {o && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" aria-hidden /> {o.label}
              </span>
            )}
          </div>

          <blockquote className="text-base font-medium leading-relaxed">
            “<Highlighted text={claim.originalText} phrases={claim.riskPhrases} />”
          </blockquote>
          {claim.summary && claim.summary !== claim.originalText && <p className="mt-1 text-sm text-muted-foreground">검증 대상: {claim.summary}</p>}
          <p className="mt-3 text-sm leading-relaxed">{claim.reasoning}</p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              분석 신뢰도 <strong className={conf.tw}>{conf.label}</strong>
            </span>
            <span>근거 {claim.citations.filter((c) => c.stance !== "context").length}건</span>
            <span>위해 가능성 {HARM_LABEL[claim.harmPotential]}</span>
            {claim.needsFurtherVerification && (
              <span className="inline-flex items-center gap-1 text-verdict-exag">
                <TriangleAlert className="size-3" aria-hidden /> 추가 검증 필요
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOpen((x) => !x)}
            aria-expanded={open}
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline"
          >
            {open ? "접기" : "자세한 분석과 근거 보기"} <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            <div className="space-y-4 border-t bg-muted/30 p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Section title="확인된 근거">{claim.supportingEvidence}</Section>
                <Section title="반박 근거">{claim.counterEvidence}</Section>
              </div>
              <Section title="과학적 설명">{claim.scientificExplanation}</Section>
              <Section title="연구의 한계">{claim.limitations}</Section>
              <Section title="분석 신뢰도 산출 근거">{claim.confidence.basis}</Section>
              {(claim.riskPhrases.length > 0 || Object.values(claim.entities).some((e) => e.length)) && (
                <div className="flex flex-wrap gap-1.5">
                  {claim.riskPhrases.map((p) => (
                    <Badge key={`r-${p}`} variant="outline" className="border-verdict-false/40 text-verdict-false">
                      위험 표현: {p}
                    </Badge>
                  ))}
                  {[...claim.entities.drugs, ...claim.entities.ingredients, ...claim.entities.diseases, ...claim.entities.effects, ...claim.entities.numbers].map((e, i) => (
                    <Badge key={`e-${i}`}>{e}</Badge>
                  ))}
                </div>
              )}
              {claim.adjustments.length > 0 && (
                <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground">자동 안전장치 적용</p>
                  <ul className="list-disc pl-4">
                    {claim.adjustments.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">근거 출처 ({claim.citations.length})</h4>
                {claim.citations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">이 주장에 연결된 검색 출처가 없습니다. 출처를 임의로 만들지 않습니다.</p>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {claim.citations.map((c) => {
                      const s = sources.get(c.sourceId);
                      return s ? <SourceCard key={c.sourceId} source={s} citation={c} /> : null;
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
