import { AI_MODEL, isAiEnabled } from "@/lib/ai/client";

export const dynamic = "force-dynamic";

/** 클라이언트에 어떤 기능이 켜져 있는지만 알려준다 (키 값은 절대 노출하지 않음). */
export function GET() {
  return Response.json({
    ai: isAiEnabled(),
    model: isAiEnabled() ? AI_MODEL : null,
    transcription: !!process.env.OPENAI_API_KEY,
    pubmedKey: !!process.env.NCBI_API_KEY,
  });
}
