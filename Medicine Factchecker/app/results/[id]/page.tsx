import type { Metadata } from "next";
import { ResultLoader } from "./result-loader";

export const metadata: Metadata = { title: "분석 결과", robots: { index: false } };

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResultLoader id={id} />;
}
