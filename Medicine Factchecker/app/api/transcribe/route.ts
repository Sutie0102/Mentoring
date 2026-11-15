import { LIMITS } from "@/lib/constants";
import { checkUpload } from "@/lib/security/fileCheck";
import { clientKey, rateLimit } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** 영상 음성 전사 — OpenAI Whisper (선택 기능). 파일은 전사 후 즉시 폐기한다. */
export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ error: "음성 전사 기능이 설정되지 않았습니다 (OPENAI_API_KEY 없음)." }, { status: 501 });

  const rl = rateLimit(`transcribe:${clientKey(req.headers)}`, 4);
  if (!rl.ok) return Response.json({ error: `요청이 너무 많습니다. ${rl.retryAfter}초 후 다시 시도하세요.` }, { status: 429 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "영상 파일이 없습니다." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkUpload(bytes, file.type, ["video/mp4", "video/quicktime"], LIMITS.maxTranscribeBytes);
  if (!check.ok) return Response.json({ error: check.reason }, { status: 415 });

  const body = new FormData();
  body.append("file", new Blob([bytes], { type: check.kind }), check.kind === "video/quicktime" ? "video.mov" : "video.mp4");
  body.append("model", "whisper-1");
  body.append("response_format", "verbose_json");
  body.append("language", "ko");
  body.append("timestamp_granularities[]", "segment");

  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body,
      signal: AbortSignal.timeout(110_000),
    });
    if (!res.ok) return Response.json({ error: `음성 전사 실패 (HTTP ${res.status})` }, { status: 502 });
    const data = (await res.json()) as { segments?: { start: number; end: number; text: string }[]; text?: string };
    const segments = (data.segments ?? []).map((s) => ({ start: s.start, end: s.end, text: s.text.trim() })).filter((s) => s.text);
    return Response.json({ segments });
  } catch {
    return Response.json({ error: "음성 전사 서버에 연결하지 못했습니다." }, { status: 502 });
  }
}
