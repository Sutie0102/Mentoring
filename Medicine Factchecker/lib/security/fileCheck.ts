/** 파일 시그니처(매직 바이트) 검사 — 확장자·MIME 위장을 차단 */

export type DetectedKind = "image/jpeg" | "image/png" | "image/webp" | "application/pdf" | "video/mp4" | "video/quicktime" | null;

export function detectFileType(bytes: Uint8Array): DetectedKind {
  const b = bytes;
  const ascii = (start: number, len: number) => String.fromCharCode(...b.slice(start, start + len));
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && ascii(1, 3) === "PNG" && b[4] === 0x0d && b[5] === 0x0a) return "image/png";
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (b.length >= 5 && ascii(0, 5) === "%PDF-") return "application/pdf";
  if (b.length >= 12 && ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4);
    return brand === "qt  " ? "video/quicktime" : "video/mp4";
  }
  return null;
}

export interface FileCheckOk {
  ok: true;
  kind: Exclude<DetectedKind, null>;
}
export interface FileCheckFail {
  ok: false;
  reason: string;
}

export function checkUpload(
  bytes: Uint8Array,
  declaredMime: string,
  allowed: readonly string[],
  maxBytes: number,
): FileCheckOk | FileCheckFail {
  if (bytes.byteLength === 0) return { ok: false, reason: "빈 파일입니다." };
  if (bytes.byteLength > maxBytes) return { ok: false, reason: `파일이 너무 큽니다 (최대 ${(maxBytes / 1024 / 1024).toFixed(0)}MB).` };
  const kind = detectFileType(bytes);
  if (!kind || !allowed.includes(kind)) return { ok: false, reason: "지원하지 않는 파일 형식이거나 파일 내용이 확장자와 일치하지 않습니다." };
  // 선언된 MIME과 실제 내용이 다른 경우(이미지끼리는 허용) 차단
  const family = (m: string) => m.split("/")[0];
  if (declaredMime && family(declaredMime) !== family(kind) && declaredMime !== "application/octet-stream") {
    return { ok: false, reason: "파일 형식 정보가 실제 내용과 일치하지 않습니다." };
  }
  if (kind === "application/pdf") {
    // 자동 실행 스크립트가 포함된 PDF 차단 (보수적 검사)
    const head = new TextDecoder("latin1").decode(bytes.slice(0, Math.min(bytes.byteLength, 2 * 1024 * 1024)));
    if (/\/JavaScript|\/JS\s|\/Launch|\/EmbeddedFile/.test(head)) {
      return { ok: false, reason: "스크립트나 실행 파일이 포함된 PDF는 보안상 분석하지 않습니다." };
    }
  }
  return { ok: true, kind };
}
