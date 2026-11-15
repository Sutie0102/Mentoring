"use client";

import { forwardRef } from "react";
import type { SessionMedia } from "@/lib/client/media";
import type { ClaimResult, MediaRef } from "@/lib/types";
import { VERDICT_META } from "@/lib/constants";

/** 이미지 위에 OCR 위치(bbox)를 겹쳐 표시 */
export function ImageWithBoxes({ media, url, claims, activeId, onSelect }: { media: MediaRef; url: string; claims: ClaimResult[]; activeId: string | null; onSelect: (id: string) => void }) {
  const boxes = claims.filter((c) => c.origin?.mediaIndex === media.index && c.origin.bbox && c.origin.imageWidth && c.origin.imageHeight);
  return (
    <figure>
      <div className="relative overflow-hidden rounded-xl border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`분석한 이미지: ${media.name}`} className="block h-auto w-full" />
        {boxes.map((c) => {
          const o = c.origin!;
          const b = o.bbox!;
          const W = o.imageWidth!;
          const H = o.imageHeight!;
          const active = activeId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              aria-label={`${c.id} 주장 위치: ${c.originalText}`}
              className="absolute rounded-sm border-2 transition-[background-color]"
              style={{
                left: `${(b.x0 / W) * 100}%`,
                top: `${(b.y0 / H) * 100}%`,
                width: `${((b.x1 - b.x0) / W) * 100}%`,
                height: `${((b.y1 - b.y0) / H) * 100}%`,
                borderColor: VERDICT_META[c.verdict].color,
                backgroundColor: active ? `${VERDICT_META[c.verdict].color}33` : "transparent",
              }}
            >
              <span className="absolute -top-5 left-0 rounded bg-card px-1 text-[10px] font-semibold shadow-soft">{c.id}</span>
            </button>
          );
        })}
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        {media.name} · 표시된 상자는 OCR로 인식한 주장 위치입니다 (OCR 오차가 있을 수 있음).
      </figcaption>
    </figure>
  );
}

export const VideoPlayer = forwardRef<HTMLVideoElement, { media: MediaRef; url: string }>(function VideoPlayer({ media, url }, ref) {
  return (
    <figure>
      <video ref={ref} src={url} controls className="w-full rounded-xl border bg-black" aria-label={`분석한 영상: ${media.name}`} />
      <figcaption className="mt-2 text-xs text-muted-foreground">{media.name} · 주장 카드의 시간 버튼을 누르면 해당 장면으로 이동합니다.</figcaption>
    </figure>
  );
});

export function MediaUnavailable({ media }: { media: MediaRef[] }) {
  if (media.length === 0) return null;
  return (
    <p className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
      첨부한 원본 파일({media.map((m) => m.name).join(", ")})은 개인정보 보호를 위해 저장하지 않습니다. 위치·시간 정보는 아래 주장 카드에서 확인할 수 있습니다.
    </p>
  );
}
