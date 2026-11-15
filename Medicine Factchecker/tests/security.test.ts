import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { isBlockedHostname, isPrivateAddress } from "@/lib/security/ip";
import { checkUpload, detectFileType } from "@/lib/security/fileCheck";
import { _resetRateLimit, rateLimit } from "@/lib/security/rateLimit";
import { validatePublicUrl } from "@/lib/security/ssrf";

describe("SSRF: IP 차단", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.0.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::", "fc00::1", "fd12::3", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "64:ff9b::a00:1"])(
    "%s 는 사설/내부 주소",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "130.14.29.110", "172.32.0.1", "2606:4700:4700::1111"])("%s 는 공인 주소", (ip) => expect(isPrivateAddress(ip)).toBe(false));
});

describe("SSRF: URL 검증", () => {
  it.each([
    "file:///etc/passwd",
    "ftp://example.com",
    "http://localhost:3000",
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://169.254.169.254/latest/meta-data",
    "http://2130706433/",
    "http://0x7f000001/",
    "http://user:pw@example.com/",
    "http://example.com:8080/",
    "http://intranet/",
    "http://printer.local/",
  ])("%s 차단", (u) => expect(() => validatePublicUrl(u)).toThrow());
  it("정상 URL 허용", () => expect(validatePublicUrl("https://www.example.com/ad?id=1").hostname).toBe("www.example.com"));
  it("호스트명 규칙", () => {
    expect(isBlockedHostname("metadata.google.internal")).toBe(true);
    expect(isBlockedHostname("nedrug.mfds.go.kr")).toBe(false);
  });
});

describe("파일 시그니처 검사", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  const pdf = new TextEncoder().encode("%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj");
  const evilPdf = new TextEncoder().encode("%PDF-1.7\n<< /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>");
  const mp4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);

  it("형식 판별", () => {
    expect(detectFileType(png)).toBe("image/png");
    expect(detectFileType(jpg)).toBe("image/jpeg");
    expect(detectFileType(pdf)).toBe("application/pdf");
    expect(detectFileType(mp4)).toBe("video/mp4");
    expect(detectFileType(new TextEncoder().encode("<html>"))).toBeNull();
  });
  it("확장자 위장 차단 (HTML을 PNG로)", () => {
    expect(checkUpload(new TextEncoder().encode("<script>alert(1)</script>"), "image/png", ["image/png"], 1e6).ok).toBe(false);
  });
  it("MIME 계열 불일치 차단 (PDF를 image로 선언)", () => {
    expect(checkUpload(pdf, "image/png", ["application/pdf"], 1e6).ok).toBe(false);
  });
  it("크기 제한", () => expect(checkUpload(png, "image/png", ["image/png"], 4).ok).toBe(false));
  it("스크립트 포함 PDF 차단", () => expect(checkUpload(evilPdf, "application/pdf", ["application/pdf"], 1e6).ok).toBe(false));
  it("정상 PDF 허용", () => expect(checkUpload(pdf, "application/pdf", ["application/pdf"], 1e6).ok).toBe(true));
});

describe("요청 제한", () => {
  it("한도 초과 시 거부, 시간이 지나면 허용", () => {
    _resetRateLimit();
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 60_000, t).ok).toBe(true);
    expect(rateLimit("k", 3, 60_000, t).ok).toBe(false);
    expect(rateLimit("k", 3, 60_000, t + 61_000).ok).toBe(true);
  });
});
