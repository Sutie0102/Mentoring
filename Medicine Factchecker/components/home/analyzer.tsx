"use client";

import { AlertCircle, FlaskConical, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fetchStatus, runAnalyzeRequest, transcribeVideo, type ServerStatus } from "@/lib/client/analyze";
import { saveAnalysis } from "@/lib/client/history";
import { downscaleForUpload, extractVideoFrames, loadImage, ocrLines, putSessionMedia, type SessionMedia } from "@/lib/client/media";
import { LIMITS } from "@/lib/constants";
import { buildSampleResult, SAMPLE_INPUT } from "@/lib/data/sample";
import type { AnalyzePayload, PipelineStep } from "@/lib/types";
import { formatBytes } from "@/lib/utils";
import { Button } from "../ui/button";
import { AnalysisProgress, type StepState } from "./analysis-progress";
import { Composer, UploadGuide, type ComposerValue } from "./composer";

const EXAMPLES = [
  SAMPLE_INPUT,
  "먹기만 하면 살 빠지는 기적의 다이어트약! 부작용 없이 한 달 만에 10kg 감량, 의사들이 추천합니다.",
  "구충제 펜벤다졸을 복용하면 말기암 환자의 암세포가 완전히 사라집니다. 항암제 없이도 치료 가능!",
  "고용량 비타민C 정맥주사가 면역력을 높여 감기 예방에 도움이 될 수 있다는 연구가 있습니다.",
];

const initialSteps = (): StepState => ({
  collect: { status: "pending" },
  extract: { status: "pending" },
  search: { status: "pending" },
  verify: { status: "pending" },
  report: { status: "pending" },
});

export function Analyzer({ initialText = "" }: { initialText?: string }) {
  const router = useRouter();
  const [value, setValue] = useState<ComposerValue>({ text: initialText, url: "", attachments: [] });
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<StepState>(initialSteps);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchStatus().then(setStatus).catch(() => setStatus(null));
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (initialText) setValue((v) => ({ ...v, text: initialText }));
  }, [initialText]);

  const setStep = (s: PipelineStep, status: "active" | "done", detail?: string) =>
    setSteps((prev) => ({ ...prev, [s]: { status, detail: detail ?? prev[s].detail } }));
  const log = (m: string) => setLogs((l) => [...l, m]);

  async function start() {
    setBusy(true);
    setError(null);
    setLogs([]);
    setSteps(initialSteps());
    const controller = new AbortController();
    abortRef.current = controller;
    const sessionItems: SessionMedia[] = [];
    try {
      const st = status ?? (await fetchStatus().catch(() => null));
      const aiOn = !!st?.ai;
      setStep("collect", "active");

      const payload: AnalyzePayload = { text: value.text.trim(), url: value.url.trim() || null, images: [], videos: [], pdfFields: [] };
      const files: { field: string; blob: Blob; name: string }[] = [];
      let idx = 0; // 서버 media index 순서: PDF → 이미지 → 영상

      for (const a of value.attachments.filter((x) => x.kind === "pdf")) {
        const field = `pdf_${payload.pdfFields.length}`;
        payload.pdfFields.push({ name: a.file.name, fileField: field });
        files.push({ field, blob: a.file, name: a.file.name });
        sessionItems.push({ index: idx++, kind: "pdf", url: URL.createObjectURL(a.file), name: a.file.name });
      }

      for (const a of value.attachments.filter((x) => x.kind === "image")) {
        log(`이미지 '${a.file.name}' 문구 인식(OCR) 중… 처음 실행 시 언어 데이터를 내려받습니다.`);
        const img = await loadImage(a.file);
        const lines = await ocrLines(a.file);
        let fileField: string | null = null;
        if (aiOn) {
          fileField = `img_${payload.images.length}`;
          files.push({ field: fileField, blob: await downscaleForUpload(img, img.naturalWidth, img.naturalHeight), name: `${a.file.name}.jpg` });
        }
        payload.images.push({ name: a.file.name, width: img.naturalWidth, height: img.naturalHeight, ocrLines: lines, fileField });
        sessionItems.push({ index: idx++, kind: "image", url: img.src, name: a.file.name });
        log(`'${a.file.name}'에서 문구 ${lines.length}줄을 인식했습니다.`);
      }

      for (const a of value.attachments.filter((x) => x.kind === "video")) {
        log(`영상 '${a.file.name}'에서 주요 프레임 추출 중…`);
        const { duration, width, height, frames } = await extractVideoFrames(a.file, LIMITS.videoFrames, (d, t) => log(`프레임 ${d}/${t} 추출`));
        if (duration > LIMITS.maxVideoSeconds) throw new Error(`영상이 ${LIMITS.maxVideoSeconds / 60}분을 넘습니다. 핵심 구간만 잘라서 올려 주세요.`);
        const frameMeta: AnalyzePayload["videos"][number]["frames"] = [];
        for (const [fi, f] of frames.entries()) {
          log(`프레임 ${fi + 1}/${frames.length} 화면 문구 인식 중…`);
          const lines = await ocrLines(f.canvas, f.scale);
          let fileField: string | null = null;
          if (aiOn) {
            fileField = `frame_${fi}`;
            files.push({ field: fileField, blob: f.blob, name: `__frame_${fi}.jpg` });
          }
          frameMeta.push({ time: f.time, ocrLines: lines, fileField });
        }
        let transcript: { start: number; end: number; text: string }[] | null = null;
        if (st?.transcription) {
          if (a.file.size <= LIMITS.maxTranscribeBytes) {
            log("영상 음성을 텍스트로 전사하는 중…");
            try {
              transcript = await transcribeVideo(a.file);
              log(`음성 전사 완료 (${transcript.length}개 구간)`);
            } catch (e) {
              log(`음성 전사 실패: ${(e as Error).message} — 화면 문구만 분석합니다.`);
            }
          } else {
            log(`영상이 ${formatBytes(LIMITS.maxTranscribeBytes)}를 넘어 음성 전사를 건너뜁니다.`);
          }
        }
        payload.videos.push({ name: a.file.name, duration, width, height, frames: frameMeta, transcript });
        sessionItems.push({ index: idx++, kind: "video", url: URL.createObjectURL(a.file), name: a.file.name });
      }

      const total = files.reduce((s, f) => s + f.blob.size, 0);
      if (total > LIMITS.maxUploadTotalBytes) {
        throw new Error(`서버로 보낼 파일 합계(${formatBytes(total)})가 ${formatBytes(LIMITS.maxUploadTotalBytes)}를 넘습니다. 첨부 파일 수를 줄여 주세요.`);
      }

      const result = await runAnalyzeRequest(
        payload,
        files,
        (e) => {
          if (e.type === "step") setStep(e.step, e.status === "start" ? "active" : "done", e.detail);
          if (e.type === "log") log(e.message);
        },
        controller.signal,
      );
      putSessionMedia(result.id, sessionItems);
      if (!saveAnalysis(result)) log("브라우저 저장 공간이 부족해 분석 기록에 저장하지 못했습니다.");
      router.push(`/results/${result.id}`);
    } catch (e) {
      sessionItems.forEach((m) => URL.revokeObjectURL(m.url));
      if ((e as Error).name !== "AbortError") setError((e as Error).message || "알 수 없는 오류가 발생했습니다.");
      setBusy(false);
    }
  }

  function openSample() {
    const r = buildSampleResult();
    saveAnalysis(r);
    router.push(`/results/${r.id}`);
  }

  return (
    <div>
      {status && !status.ai && (
        <div className="mx-auto mb-4 flex max-w-3xl items-start gap-2 rounded-xl border border-verdict-exag/40 bg-verdict-exag/10 px-4 py-3 text-sm">
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-verdict-exag" aria-hidden />
          <p>
            <strong>데모 모드</strong> — 서버에 AI API 키가 설정되지 않아 규칙 기반 분석만 수행합니다. PubMed·ClinicalTrials.gov 검색은 실제로 실행되지만, 진실·허위 판정은 하지 않습니다.
          </p>
        </div>
      )}
      <div className="mx-auto max-w-3xl">
        <Composer value={value} onChange={setValue} onSubmit={start} busy={busy} />
        <UploadGuide />
      </div>

      {error && (
        <div role="alert" className="mx-auto mt-4 flex max-w-3xl items-start gap-2 rounded-xl border border-verdict-false/40 bg-verdict-false/10 px-4 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-verdict-false" aria-hidden />
          <div>
            <p className="font-medium">분석하지 못했습니다</p>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {busy && <AnalysisProgress steps={steps} logs={logs} />}

      {!busy && (
        <div className="mx-auto mt-8 max-w-3xl">
          <p className="mb-3 text-sm font-medium text-muted-foreground">예시 문구로 시작하기</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setValue((v) => ({ ...v, text: ex }))}
                className="rounded-xl border bg-card px-4 py-3 text-left text-sm shadow-soft transition-colors hover:border-teal/50 hover:bg-muted/50"
              >
                “{ex}”
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-center">
            <Button variant="link" onClick={openSample}>
              <Sparkles /> API 키 없이 샘플 결과 미리 보기
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
