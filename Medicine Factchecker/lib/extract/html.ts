/** 의존성 없이 HTML에서 본문 텍스트를 추출한다 (스크립트·스타일·내비게이션 제거). */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", middot: "·" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

export function htmlToParagraphs(html: string): { title: string; description: string; paragraphs: string[] } {
  const title = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? "");
  const description = decodeEntities(
    /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)["']/i.exec(html)?.[1] ?? "",
  );
  let body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html;
  body = body
    .replace(/\s+/g, " ") // 소스 코드의 줄바꿈은 문단 경계가 아님
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|iframe|template|nav|footer|header|form|aside)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<img[^>]+alt=["']([^"']{4,})["'][^>]*>/gi, "\n[이미지 대체텍스트] $1\n")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article|\/blockquote)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const paragraphs = decodeEntities(body)
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length >= 8);
  // 중복 줄 제거
  const seen = new Set<string>();
  const unique = paragraphs.filter((p) => (seen.has(p) ? false : (seen.add(p), true)));
  return { title, description, paragraphs: unique };
}
