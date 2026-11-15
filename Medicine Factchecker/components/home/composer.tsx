"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, FileText, Film, ImageIcon, Link2, Loader2, Paperclip, Upload, X } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import { ACCEPT_ATTR, ACCEPTED, LIMITS } from "@/lib/constants";
import { cn, formatBytes } from "@/lib/utils";
import { Button } from "../ui/button";

export type AttachmentKind = "image" | "video" | "pdf";

export interface Attachment {
  id: string;
  file: File;
  kind: AttachmentKind;
  previewUrl: string | null;
}

export interface ComposerValue {
  text: string;
  url: string;
  attachments: Attachment[];
}

function kindOf(file: File): AttachmentKind | null {
  const t = file.type;
  if ((ACCEPTED.image as readonly string[]).includes(t)) return "image";
  if ((ACCEPTED.video as readonly string[]).includes(t)) return "video";
  if ((ACCEPTED.pdf as readonly string[]).includes(t)) return "pdf";
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && ["jpg", "jpeg", "png", "webp"].includes(ext)) return "image";
  if (ext && ["mp4", "mov"].includes(ext)) return "video";
  if (ext === "pdf") return "pdf";
  return null;
}

function validate(file: File, kind: AttachmentKind, current: Attachment[]): string | null {
  const count = current.filter((a) => a.kind === kind).length;
  if (kind === "image") {
    if (count >= LIMITS.maxImages) return `이미지는 최대 ${LIMITS.maxImages}개까지 첨부할 수 있습니다.`;
    if (file.size > LIMITS.maxImageBytes) return `이미지 '${file.name}'이(가) ${formatBytes(LIMITS.maxImageBytes)}를 넘습니다.`;
  }
  if (kind === "pdf") {
    if (count >= LIMITS.maxPdfs) return `PDF는 최대 ${LIMITS.maxPdfs}개까지 첨부할 수 있습니다.`;
    if (file.size > LIMITS.maxPdfBytes) return `PDF '${file.name}'이(가) ${formatBytes(LIMITS.maxPdfBytes)}를 넘습니다.`;
  }
  if (kind === "video") {
    if (count >= LIMITS.maxVideos) return "영상은 1개만 첨부할 수 있습니다.";
    if (file.size > LIMITS.maxVideoBytes) return `영상 '${file.name}'이(가) ${formatBytes(LIMITS.maxVideoBytes)}를 넘습니다.`;
  }
  return null;
}

const KIND_ICON = { image: ImageIcon, video: Film, pdf: FileText };

export function Composer({
  value,
  onChange,
  onSubmit,
  busy,
}: {
  value: ComposerValue;
  onChange: (v: ComposerValue) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [showUrl, setShowUrl] = useState(!!value.url);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      setError(null);
      const next = [...value.attachments];
      for (const file of Array.from(files)) {
        const kind = kindOf(file);
        if (!kind) {
          setError(`'${file.name}'은(는) 지원하지 않는 형식입니다. JPG, PNG, WEBP, MP4, MOV, PDF만 가능합니다.`);
          continue;
        }
        const err = validate(file, kind, next);
        if (err) {
          setError(err);
          continue;
        }
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          kind,
          previewUrl: kind === "pdf" ? null : URL.createObjectURL(file),
        });
      }
      onChange({ ...value, attachments: next });
    },
    [value, onChange],
  );

  const remove = (id: string) => {
    const a = value.attachments.find((x) => x.id === id);
    if (a?.previewUrl) URL.revokeObjectURL(a.previewUrl);
    onChange({ ...value, attachments: value.attachments.filter((x) => x.id !== id) });
  };

  const canSubmit = !busy && (value.text.trim().length > 0 || value.url.trim().length > 0 || value.attachments.length > 0);

  return (
    <div
      className={cn(
        "relative rounded-3xl border bg-card p-3 shadow-soft transition-[border-color,box-shadow] focus-within:border-teal/60 sm:p-4",
        dragging && "border-teal ring-4 ring-teal/15",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
      }}
    >
      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-3xl bg-teal-soft/80 text-teal"
          >
            <div className="flex flex-col items-center gap-2 font-medium">
              <Upload className="size-8" aria-hidden />
              파일을 여기에 놓으세요
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {value.attachments.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2" aria-label="첨부 파일">
          {value.attachments.map((a) => {
            const Icon = KIND_ICON[a.kind];
            return (
              <li key={a.id} className="group relative flex items-center gap-2 rounded-xl border bg-muted/60 p-1.5 pr-8">
                {a.kind === "image" && a.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.previewUrl} alt="" className="size-11 rounded-lg object-cover" />
                ) : a.kind === "video" && a.previewUrl ? (
                  <video src={a.previewUrl} muted className="size-11 rounded-lg bg-black object-cover" aria-hidden />
                ) : (
                  <span className="grid size-11 place-items-center rounded-lg bg-card">
                    <Icon className="size-5 text-muted-foreground" aria-hidden />
                  </span>
                )}
                <span className="max-w-[10rem] text-xs">
                  <span className="block truncate font-medium">{a.file.name}</span>
                  <span className="text-muted-foreground">
                    {a.kind === "image" ? "이미지" : a.kind === "video" ? "영상" : "PDF"} · {formatBytes(a.file.size)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => remove(a.id)}
                  disabled={busy}
                  className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground"
                  aria-label={`${a.file.name} 첨부 제거`}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <label htmlFor={inputId} className="sr-only">
        분석할 광고 문구
      </label>
      <textarea
        id={inputId}
        value={value.text}
        onChange={(e) => onChange({ ...value, text: e.target.value.slice(0, LIMITS.maxTextChars) })}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) onSubmit();
        }}
        disabled={busy}
        rows={3}
        placeholder="광고 문구를 붙여넣거나, 이미지·영상·PDF를 끌어다 놓으세요"
        className="w-full resize-none bg-transparent px-2 py-1 text-base outline-none placeholder:text-muted-foreground/80 sm:text-[17px]"
      />

      {showUrl && (
        <div className="mx-1 mb-2 flex items-center gap-2 rounded-xl border bg-muted/50 px-3">
          <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <label htmlFor={`${inputId}-url`} className="sr-only">
            분석할 웹페이지 URL
          </label>
          <input
            id={`${inputId}-url`}
            type="url"
            inputMode="url"
            value={value.url}
            disabled={busy}
            onChange={(e) => onChange({ ...value, url: e.target.value })}
            placeholder="https://광고-페이지-주소"
            className="h-10 w-full bg-transparent text-sm outline-none"
          />
          {value.url && (
            <button type="button" onClick={() => onChange({ ...value, url: "" })} aria-label="URL 지우기" className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-1">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => fileRef.current?.click()} aria-label="파일 첨부 (이미지, 영상, PDF)">
          <Paperclip /> <span className="hidden sm:inline">파일 첨부</span>
        </Button>
        <Button type="button" variant={showUrl ? "outline" : "ghost"} size="sm" disabled={busy} onClick={() => setShowUrl((s) => !s)} aria-pressed={showUrl}>
          <Link2 /> <span className="hidden sm:inline">URL</span>
        </Button>
        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">{value.text.length.toLocaleString()} / {LIMITS.maxTextChars.toLocaleString()}</span>
        <Button type="button" onClick={onSubmit} disabled={!canSubmit} className="ml-2 h-10 rounded-full px-4" aria-label="분석 시작">
          {busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
          <span>분석 시작</span>
        </Button>
      </div>

      {error && (
        <p role="alert" className="mx-2 mt-2 text-sm text-verdict-false">
          {error}
        </p>
      )}
    </div>
  );
}

export function UploadGuide() {
  return (
    <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
      지원 형식: JPG·PNG·WEBP(각 {formatBytes(LIMITS.maxImageBytes)}, 최대 {LIMITS.maxImages}개) · PDF(각 {formatBytes(LIMITS.maxPdfBytes)}, 최대 {LIMITS.maxPdfs}개) · MP4·MOV({formatBytes(LIMITS.maxVideoBytes)}, {LIMITS.maxVideoSeconds / 60}분 이하 1개)
      <br />
      영상은 서버로 업로드하지 않고 브라우저에서 주요 프레임만 추출합니다. 서버 전송 합계는 {formatBytes(LIMITS.maxUploadTotalBytes)}까지입니다.
    </p>
  );
}
