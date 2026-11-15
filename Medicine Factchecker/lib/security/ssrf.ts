import "server-only";
import dns from "node:dns";
import net from "node:net";
import { Agent, fetch as undiciFetch } from "undici";
import { LIMITS } from "../constants";
import { isBlockedHostname, isPrivateAddress } from "./ip";

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

/** 사용자 URL 1차 검증 (형식·프로토콜·포트·호스트) */
export function validatePublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new UnsafeUrlError("올바른 URL 형식이 아닙니다.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeUrlError("http/https URL만 분석할 수 있습니다.");
  if (url.username || url.password) throw new UnsafeUrlError("계정 정보가 포함된 URL은 허용되지 않습니다.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new UnsafeUrlError("표준 포트(80/443)만 허용됩니다.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isBlockedHostname(host)) throw new UnsafeUrlError("내부 네트워크 주소는 분석할 수 없습니다.");
  if (net.isIP(host) && isPrivateAddress(host)) throw new UnsafeUrlError("사설·내부 IP 주소는 분석할 수 없습니다.");
  return url;
}

/**
 * DNS 조회 단계에서 사설 IP를 차단하는 lookup.
 * 실제 연결에 사용되는 주소를 직접 검사하므로 DNS 리바인딩도 방어된다.
 */
const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return (callback as (e: Error | null) => void)(err);
    const list = addresses as dns.LookupAddress[];
    const bad = list.find((a) => isPrivateAddress(a.address));
    if (bad || list.length === 0) {
      return (callback as (e: Error | null) => void)(new UnsafeUrlError("내부 네트워크로 연결되는 주소는 차단됩니다."));
    }
    if ((options as dns.LookupOptions).all) return (callback as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    (callback as (e: null, a: string, f: number) => void)(null, list[0].address, list[0].family);
  });
};

const agent = new Agent({ connect: { lookup: safeLookup, timeout: LIMITS.urlTimeoutMs } });

export interface SafeFetchResult {
  finalUrl: string;
  contentType: string;
  body: string;
}

/** SSRF 방어 fetch: 리다이렉트를 수동으로 따라가며 매 단계 재검증, 크기·시간 제한 */
export async function safeFetchText(rawUrl: string, maxRedirects = 3): Promise<SafeFetchResult> {
  let url = validatePublicUrl(rawUrl);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await undiciFetch(url, {
      dispatcher: agent,
      redirect: "manual",
      signal: AbortSignal.timeout(LIMITS.urlTimeoutMs),
      headers: {
        "user-agent": "MedFactAI/0.1 (health-ad fact checker)",
        accept: "text/html,application/xhtml+xml,text/plain;q=0.8",
        "accept-language": "ko,en;q=0.8",
      },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      await res.body?.cancel();
      if (!loc) throw new UnsafeUrlError("리다이렉트 주소가 없습니다.");
      url = validatePublicUrl(new URL(loc, url).toString());
      continue;
    }
    if (!res.ok) throw new Error(`페이지를 불러오지 못했습니다 (HTTP ${res.status}).`);
    const contentType = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml|text\/plain/i.test(contentType)) {
      await res.body?.cancel();
      throw new Error("HTML/텍스트 페이지만 분석할 수 있습니다. PDF는 파일로 첨부해 주세요.");
    }
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > LIMITS.urlMaxBytes) {
      await res.body?.cancel();
      throw new Error("페이지가 너무 큽니다 (2MB 초과).");
    }
    const reader = res.body?.getReader();
    if (!reader) return { finalUrl: url.toString(), contentType, body: "" };
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > LIMITS.urlMaxBytes) {
        await reader.cancel();
        throw new Error("페이지가 너무 큽니다 (2MB 초과).");
      }
      chunks.push(value);
    }
    const charset = /charset=([^;]+)/i.exec(contentType)?.[1]?.trim() ?? "utf-8";
    let decoder: TextDecoder;
    try {
      decoder = new TextDecoder(charset);
    } catch {
      decoder = new TextDecoder("utf-8");
    }
    return { finalUrl: url.toString(), contentType, body: decoder.decode(Buffer.concat(chunks)) };
  }
  throw new UnsafeUrlError("리다이렉트가 너무 많습니다.");
}
