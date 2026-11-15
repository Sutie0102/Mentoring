import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

export async function extractPdfText(bytes: Uint8Array): Promise<{ pages: number; text: string }> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  return { pages: totalPages, text: (Array.isArray(text) ? text.join("\n") : text).trim() };
}
