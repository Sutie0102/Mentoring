import { BookOpenCheck, Database, Scale } from "lucide-react";
import { Analyzer } from "@/components/home/analyzer";

const FEATURES = [
  { icon: Database, title: "실제 출처만 사용", desc: "PubMed·ClinicalTrials.gov·식약처·WHO 등에서 실제로 검색된 자료만 근거로 씁니다." },
  { icon: Scale, title: "4단계 판정", desc: "진실 · 과장 · 허위 · 판단 불가. 근거가 부족하면 단정하지 않습니다." },
  { icon: BookOpenCheck, title: "근거 수준 표시", desc: "체계적 문헌고찰부터 세포실험까지 연구 유형과 한계를 함께 보여줍니다." },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ text?: string }> }) {
  const { text } = await searchParams;
  return (
    <>
      <section className="pt-14 pb-8 text-center sm:pt-20">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground shadow-soft">
          <span className="size-1.5 rounded-full bg-teal" aria-hidden /> 의약품·건강 광고 AI 팩트체커
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          이 광고, <span className="bg-gradient-to-r from-[#1e2f6b] to-[#0d9488] bg-clip-text text-transparent dark:from-[#a5b4fc] dark:to-[#2dd4bf]">정말 믿어도 될까요?</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
          AI가 의약품과 건강 광고의 주장을 분석하고 과학적 근거를 확인합니다.
        </p>
      </section>

      <Analyzer initialText={typeof text === "string" ? text.slice(0, 2000) : ""} />

      <section className="mx-auto mt-16 grid max-w-5xl gap-4 sm:grid-cols-3" aria-label="서비스 특징">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-2xl border bg-card p-5 shadow-soft">
            <f.icon className="mb-3 size-6 text-teal" aria-hidden />
            <h2 className="font-semibold">{f.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>
    </>
  );
}
