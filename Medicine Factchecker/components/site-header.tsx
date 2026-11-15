"use client";

import { Menu, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "./ui/button";

const NAV = [
  { href: "/about", label: "서비스 소개" },
  { href: "/cases", label: "사례 탐색" },
  { href: "/history", label: "분석 기록" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold" aria-label="MedFact AI 홈">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[#1e2f6b] to-[#0d9488] text-white shadow-soft">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <span className="text-lg tracking-tight">
            MedFact <span className="text-teal">AI</span>
          </span>
        </Link>
        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="주 메뉴">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={pathname === n.href ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                pathname === n.href && "bg-muted text-foreground",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 md:ml-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="메뉴 열기" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      {open && (
        <nav className="border-t px-4 py-2 md:hidden" aria-label="모바일 메뉴">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-sm hover:bg-muted">
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
