import { ACCEPTED, LIMITS } from "@/lib/constants";
import { runAnalysis, type UploadedFile } from "@/lib/pipeline";
import { checkUpload } from "@/lib/security/fileCheck";
import { clientKey, rateLimit } from "@/lib/security/rateLimit";
import { AnalyzePayloadSchema, type ProgressEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function jsonError(message: string, status: number, extra?: Record<string, string>) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });
}

export async function POST(req: Request) {
  const limit = Number(process.env.RATE_LIMIT_PER_MINUTE || 8);
  const rl = rateLimit(`analyze:${clientKey(req.headers)}`, limit);
  if (!rl.ok) return jsonError(`요청이 너무 많습니다. ${rl.retryAfter}초 후 다시 시도해 주세요.`, 429, { "retry-after": String(rl.retryAfter) });

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > LIMITS.maxUploadTotalBytes + 512 * 1024) {
    return jsonError(`업로드 용량이 너무 큽니다 (최대 ${LIMITS.maxUploadTotalBytes / 1024 / 1024}MB).`, 413);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("요청 형식이 올바르지 않습니다.", 400);
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(String(form.get("payload") ?? "{}"));
  } catch {
    return jsonError("요청 데이터(JSON)를 해석할 수 없습니다.", 400);
  }
  const parsed = AnalyzePayloadSchema.safeParse(rawPayload);
  if (!parsed.success) return jsonError(`입력값이 올바르지 않습니다: ${parsed.error.issues[0]?.path.join(".")}`, 400);
  const payload = parsed.data;
  if (payload.text.length > LIMITS.maxTextChars) return jsonError("텍스트가 너무 깁니다.", 400);

  // 파일 검증: 필드별 허용 형식을 페이로드 메타데이터로 결정
  const pdfFields = new Set(payload.pdfFields.map((p) => p.fileField));
  const imageFields = new Set([
    ...payload.images.map((i) => i.fileField).filter((f): f is string => !!f),
    ...payload.videos.flatMap((v) => v.frames.map((f) => f.fileField)).filter((f): f is string => !!f),
  ]);
  const files = new Map<string, UploadedFile>();
  let total = 0;
  for (const [key, value] of form.entries()) {
    if (key === "payload") continue;
    if (!(value instanceof File)) continue;
    if (!pdfFields.has(key) && !imageFields.has(key)) return jsonError("알 수 없는 파일 필드가 포함되어 있습니다.", 400);
    const bytes = new Uint8Array(await value.arrayBuffer());
    total += bytes.byteLength;
    if (total > LIMITS.maxUploadTotalBytes) return jsonError(`업로드 합계가 ${LIMITS.maxUploadTotalBytes / 1024 / 1024}MB를 넘습니다.`, 413);
    const isPdf = pdfFields.has(key);
    const check = checkUpload(bytes, value.type, isPdf ? ACCEPTED.pdf : ACCEPTED.image, isPdf ? LIMITS.maxPdfBytes : LIMITS.maxImageBytes);
    if (!check.ok) return jsonError(`'${value.name}': ${check.reason}`, 415);
    files.set(key, { name: value.name.slice(0, 200), mime: check.kind, bytes });
  }

  if (!payload.text.trim() && !payload.url && files.size === 0 && payload.images.length === 0 && payload.videos.length === 0) {
    return jsonError("분석할 텍스트, URL 또는 파일을 입력해 주세요.", 400);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: ProgressEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        const result = await runAnalysis(payload, files, send);
        send({ type: "result", result });
      } catch (e) {
        // 민감한 의료정보가 로그에 남지 않도록 오류 종류만 기록
        console.error("[analyze] failed:", (e as Error).name);
        send({ type: "error", message: (e as Error).message || "분석 중 알 수 없는 오류가 발생했습니다." });
      } finally {
        files.clear(); // 업로드 자료는 메모리에서만 처리하고 즉시 폐기
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
