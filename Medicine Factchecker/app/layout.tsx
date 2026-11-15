import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { DISCLAIMER } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "MedFact AI — 의약품·건강 광고 AI 팩트체커", template: "%s | MedFact AI" },
  description: "AI가 의약품과 건강 광고의 주장을 분석하고 PubMed·ClinicalTrials.gov·공공기관 자료로 과학적 근거를 확인합니다.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      </head>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2">
            본문으로 건너뛰기
          </a>
          <SiteHeader />
          <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
            {children}
          </main>
          <footer className="border-t">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-muted-foreground sm:px-6">
              <p>{DISCLAIMER}</p>
              <p>
                분석 결과는 참고용이며 법적·의학적 판단을 대신하지 않습니다. ·{" "}
                <Link href="/about#privacy" className="underline underline-offset-2 hover:text-foreground">
                  개인정보 처리 안내
                </Link>
              </p>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
