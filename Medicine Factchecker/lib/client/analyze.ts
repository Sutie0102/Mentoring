"use client";

import type { AnalysisResult, AnalyzePayload, ProgressEvent } from "../types";

export interface ServerStatus {
  ai: boolean;
  model: string | null;
  transcription: boolean;
  pubmedKey: boolean;
}

export async function fetchStatus(): Promise<ServerStatus> {
  const res = await fetch("/api/status", { cache: "no-store" });
  if (!res.ok) throw new Error("서버 상태를 확인할 수 없습니다.");
  return res.json();
}

export async function transcribeVideo(file: File): Promise<{ start: number; end: number; text: string }[]> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/transcribe", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `음성 전사 실패 (HTTP ${res.status})`);
  return data.segments ?? [];
}

/** /api/analyze 호출 후 NDJSON 진행 이벤트를 순서대로 전달 */
export async function runAnalyzeRequest(
  payload: AnalyzePayload,
  files: { field: string; blob: Blob; name: string }[],
  onEvent: (e: ProgressEvent) => void,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const fd = new FormData();
  fd.append("payload", JSON.stringify(payload));
  for (const f of files) fd.append(f.field, f.blob, f.name);

  let res: Response;
  try {
    res = await fetch("/api/analyze", { method: "POST", body: fd, signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new Error("서버에 연결하지 못했습니다. 네트워크 상태를 확인해 주세요.");
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `분석 요청 실패 (HTTP ${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: AnalysisResult | null = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const event = JSON.parse(line) as ProgressEvent;
      onEvent(event);
      if (event.type === "error") throw new Error(event.message);
      if (event.type === "result") result = event.result;
    }
  }
  if (!result) throw new Error("분석 결과를 받지 못했습니다. 서버 처리 시간이 초과되었을 수 있습니다.");
  return result;
}
