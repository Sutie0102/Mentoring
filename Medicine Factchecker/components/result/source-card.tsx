"use client";

import { ChevronDown, ExternalLink, FlaskConical, Info } from "lucide-react";
import { useState } from "react";
import { STUDY_TYPE_META } from "@/lib/constants";
import type { Citation, Source } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";

const PROVIDER_LABEL: Record<Source["provider"], string> = {
  pubmed: "PubMed",
  clinicaltrials: "ClinicalTrials.gov",
  official_web: "공식 기관",
  curated: "참고 자료",
};

const STANCE: Record<Citation["stance"], { label: string; cls: string }> = {
  supports: { label: "뒷받침", cls: "text-verdict-true border-verdict-true/40" },
  refutes: { label: "반박", cls: "text-verdict-false border-verdict-false/40" },
  context: { label: "참고", cls: "text-muted-foreground" },
};

export function SourceCard({ source, citation }: { source: Source; citation?: Citation }) {
  const [open, setOpen] = useState(false);
  const st = STUDY_TYPE_META[source.studyType];
  return (
    <article className="rounded-xl border bg-background/60 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline">{PROVIDER_LABEL[source.provider]}</Badge>
        <Badge variant={source.studyType === "cell" || source.studyType === "animal" ? "warning" : "teal"}>
          <FlaskConical aria-hidden /> {st.label}
        </Badge>
        {citation && <Badge variant="outline" className={STANCE[citation.stance].cls}>{STANCE[citation.stance].label}</Badge>}
        {source.titleOnly && <Badge variant="warning">제목만 확인 · 근거 아님</Badge>}
      </div>
      <h4 className="text-sm font-medium leading-snug">
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="hover:text-teal hover:underline">
          {source.title}
        </a>
      </h4>
      <p className="mt-1 text-xs text-muted-foreground">
        {source.publisher}
        {source.date ? ` · ${source.date}` : ""}
      </p>
      {citation && (
        <dl className="mt-3 space-y-1.5 text-sm">
          <div>
            <dt className="inline font-medium">관련성: </dt>
            <dd className="inline text-muted-foreground">{citation.relevance}</dd>
          </div>
          <div>
            <dt className="inline font-medium">근거의 한계: </dt>
            <dd className="inline text-muted-foreground">{citation.limitation}</dd>
          </div>
        </dl>
      )}
      {st.caution && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-verdict-exag">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {st.caution}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline">
          원문 확인 <ExternalLink className="size-3" aria-hidden />
        </a>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          검색된 발췌 {open ? "접기" : "보기"} <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </div>
      {open && (
        <div className="mt-2 rounded-lg bg-muted/70 p-3 text-xs leading-relaxed text-muted-foreground">
          <p>{source.snippet}</p>
          <p className="mt-2 opacity-80">연구 유형 판단 근거: {source.studyTypeBasis}</p>
        </div>
      )}
    </article>
  );
}
