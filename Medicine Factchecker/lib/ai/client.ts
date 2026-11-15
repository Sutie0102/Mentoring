import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const AI_MODEL = process.env.AI_MODEL || "claude-opus-5-5";

export function isAiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

let _client: Anthropic | null = null;
export function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 180_000 });
  return _client;
}

/** 거부 시 서버 측 대체 모델로 자동 재시도 (Anthropic server-side fallback) */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export class AiError extends Error {
  constructor(
    message: string,
    public code: "refusal" | "truncated" | "invalid_json" | "schema" | "api",
  ) {
    super(message);
    this.name = "AiError";
  }
}

type JsonSchema = Record<string, unknown>;

/** 구조화 출력용 JSON 스키마로 변환: 모든 객체를 닫고 모든 속성을 required로, 미지원 키워드 제거 */
export function toStrictJsonSchema(schema: z.ZodType): JsonSchema {
  const raw = z.toJSONSchema(schema, { target: "draft-2020-12", io: "output" }) as JsonSchema;
  const UNSUPPORTED = ["$schema", "minLength", "maxLength", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "maxItems", "minItems", "pattern", "format", "default"];
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (UNSUPPORTED.includes(k)) continue;
      obj[k] = walk(v);
    }
    if (obj.type === "object" && obj.properties && typeof obj.properties === "object") {
      obj.additionalProperties = false;
      obj.required = Object.keys(obj.properties as object);
    }
    return obj;
  };
  return walk(raw) as JsonSchema;
}

type Content = Anthropic.Beta.Messages.BetaContentBlockParam[];

/**
 * 구조화 JSON 응답을 받아 Zod로 다시 검증한다.
 * 스키마 검증 실패 시 1회 재시도.
 */
export async function callStructured<S extends z.ZodType>(opts: {
  system: string;
  content: Content;
  schema: S;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<S>> {
  const client = getClient();
  const jsonSchema = toStrictJsonSchema(opts.schema);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const stream = client.beta.messages.stream({
        model: AI_MODEL,
        max_tokens: opts.maxTokens ?? 32000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        system: opts.system,
        output_config: { effort: opts.effort ?? "high", format: { type: "json_schema", schema: jsonSchema } },
        messages: [{ role: "user", content: opts.content }],
      });
      const msg = await stream.finalMessage();
      if (msg.stop_reason === "refusal") throw new AiError("AI가 이 요청의 분석을 거부했습니다.", "refusal");
      if (msg.stop_reason === "max_tokens") throw new AiError("AI 응답이 길이 제한으로 잘렸습니다.", "truncated");
      const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new AiError("AI 응답이 올바른 JSON이 아닙니다.", "invalid_json");
      }
      const parsed = opts.schema.safeParse(json);
      if (!parsed.success) throw new AiError(`AI 응답이 스키마와 맞지 않습니다: ${parsed.error.issues[0]?.message}`, "schema");
      return parsed.data;
    } catch (e) {
      lastErr = e;
      if (e instanceof AiError && (e.code === "invalid_json" || e.code === "schema") && attempt === 0) continue;
      throw normalizeAiError(e);
    }
  }
  throw normalizeAiError(lastErr);
}

export function normalizeAiError(e: unknown): Error {
  if (e instanceof AiError) return e;
  if (e instanceof Anthropic.AuthenticationError) return new AiError("AI API 키가 올바르지 않습니다. 서버의 ANTHROPIC_API_KEY를 확인하세요.", "api");
  if (e instanceof Anthropic.RateLimitError) return new AiError("AI API 요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.", "api");
  if (e instanceof Anthropic.BadRequestError) return new AiError(`AI 요청 형식 오류: ${e.message}`, "api");
  if (e instanceof Anthropic.APIConnectionError) return new AiError("AI 서버에 연결하지 못했습니다.", "api");
  if (e instanceof Anthropic.APIError) return new AiError(`AI API 오류 (${e.status})`, "api");
  return e instanceof Error ? e : new Error(String(e));
}
