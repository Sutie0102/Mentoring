"use client";

import type { OcrLine } from "../types";

/* ───────── OCR (tesseract.js, 브라우저에서 실행 — 이미지가 서버로 가기 전 처리) ───────── */

type TWorker = Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>;
let workerPromise: Promise<TWorker> | null = null;

async function getWorker(): Promise<TWorker> {
  if (!workerPromise) {
    workerPromise = import("tesseract.js").then(({ createWorker }) => createWorker(["kor", "eng"]));
    workerPromise.catch(() => (workerPromise = null));
  }
  return workerPromise;
}

/** 이미지/캔버스에서 줄 단위 텍스트와 위치(bbox)를 추출. scale은 원본 좌표로 되돌리는 배율 */
export async function ocrLines(image: HTMLCanvasElement | File | Blob, scale = 1): Promise<OcrLine[]> {
  const worker = await getWorker();
  const { data } = await worker.recognize(image, {}, { blocks: true, text: true });
  const lines: OcrLine[] = [];
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs) {
      for (const line of para.lines) {
        const text = line.text.replace(/\s+/g, " ").trim();
        if (!text) continue;
        lines.push({
          text: text.slice(0, 2000),
          confidence: Math.max(0, Math.min(100, line.confidence)),
          bbox: { x0: line.bbox.x0 * scale, y0: line.bbox.y0 * scale, x1: line.bbox.x1 * scale, y1: line.bbox.y1 * scale },
        });
      }
    }
  }
  return lines.slice(0, 200);
}

export async function terminateOcr() {
  if (workerPromise) {
    const w = await workerPromise.catch(() => null);
    await w?.terminate();
    workerPromise = null;
  }
}

/* ───────── 이미지 ───────── */

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 열 수 없습니다."));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지 변환 실패"))), "image/jpeg", quality),
  );
}

/** 서버(비전 분석) 전송용 축소본 — 업로드 용량 절약 */
export async function downscaleForUpload(img: HTMLImageElement | HTMLVideoElement, w: number, h: number, maxSide = 1400): Promise<Blob> {
  const s = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * s);
  canvas.height = Math.round(h * s);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvasToBlob(canvas);
}

/* ───────── 영상: 주요 프레임 추출 ───────── */

export interface ExtractedFrame {
  time: number;
  blob: Blob;
  canvas: HTMLCanvasElement;
  scale: number; // canvas → 원본 영상 좌표 배율
}

export async function extractVideoFrames(
  file: File,
  count: number,
  onProgress?: (done: number, total: number) => void,
): Promise<{ duration: number; width: number; height: number; frames: ExtractedFrame[] }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("이 브라우저에서 영상을 열 수 없습니다 (코덱 미지원일 수 있음)."));
    });
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) throw new Error("영상 크기를 확인할 수 없습니다.");
    const n = Math.max(1, Math.min(count, Math.ceil(duration / 2) || 1));
    const frames: ExtractedFrame[] = [];
    const scaleDown = Math.min(1, 1024 / Math.max(width, height));
    for (let i = 0; i < n; i++) {
      const t = duration > 0 ? ((i + 0.5) * duration) / n : 0;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("영상 프레임 탐색 시간 초과")), 10000);
        video.onseeked = () => {
          clearTimeout(timer);
          resolve();
        };
        video.currentTime = t;
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scaleDown);
      canvas.height = Math.round(height * scaleDown);
      canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push({ time: t, blob: await canvasToBlob(canvas, 0.72), canvas, scale: 1 / scaleDown });
      onProgress?.(i + 1, n);
    }
    return { duration, width, height, frames };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

/* ───────── 원본 미디어 세션 보관 (메모리 전용, 새로고침 시 사라짐) ───────── */

export interface SessionMedia {
  index: number;
  kind: "image" | "video" | "pdf";
  url: string;
  name: string;
}

const sessionMedia = new Map<string, SessionMedia[]>();

export function putSessionMedia(analysisId: string, items: SessionMedia[]) {
  sessionMedia.set(analysisId, items);
}
export function getSessionMedia(analysisId: string): SessionMedia[] {
  return sessionMedia.get(analysisId) ?? [];
}
export function dropSessionMedia(analysisId?: string) {
  const ids = analysisId ? [analysisId] : [...sessionMedia.keys()];
  for (const id of ids) {
    for (const m of sessionMedia.get(id) ?? []) URL.revokeObjectURL(m.url);
    sessionMedia.delete(id);
  }
}
