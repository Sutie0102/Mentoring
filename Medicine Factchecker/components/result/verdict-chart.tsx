"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { VERDICT_META } from "@/lib/constants";
import type { Verdict, VerdictRatio } from "@/lib/types";
import { VERDICTS } from "@/lib/types";
import { VerdictIcon } from "../verdict-icon";

function useVerdictColors() {
  const { resolvedTheme } = useTheme();
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(resolvedTheme === "dark"), [resolvedTheme]);
  return { color: (v: Verdict) => (dark ? VERDICT_META[v].darkColor : VERDICT_META[v].color), surface: dark ? "#111a2e" : "#ffffff" };
}

interface Datum {
  verdict: Verdict;
  label: string;
  value: number;
  count: number;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Datum }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-soft">
      <p className="font-medium">{d.label}</p>
      <p className="text-muted-foreground">
        주장 {d.count}개 · {d.value}%
      </p>
    </div>
  );
}

/** 도넛 차트 — '주장 분류 비율'(진실일 확률이 아님) */
export function VerdictDonut({ ratio, counts }: { ratio: VerdictRatio; counts: Record<Verdict, number> }) {
  const { color, surface } = useVerdictColors();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const data: Datum[] = VERDICTS.map((v) => ({ verdict: v, label: VERDICT_META[v].label, value: ratio[v], count: counts[v] })).filter((d) => d.value > 0);
  return (
    <div className="relative mx-auto size-[200px]">
      <PieChart width={200} height={200}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={64}
            outerRadius={94}
            startAngle={90}
            endAngle={-270}
            paddingAngle={data.length > 1 ? 2 : 0}
            cornerRadius={4}
            stroke={surface}
            strokeWidth={2}
            isAnimationActive
          >
            {data.map((d) => (
              <Cell key={d.verdict} fill={color(d.verdict)} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
      </PieChart>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-3xl font-bold tabular-nums">{total}</p>
          <p className="text-xs text-muted-foreground">추출된 주장</p>
        </div>
      </div>
    </div>
  );
}

/** 진행 막대 + 범례 (색만으로 구분하지 않도록 아이콘·라벨·수치를 함께 표시) */
export function VerdictBars({ ratio, counts }: { ratio: VerdictRatio; counts: Record<Verdict, number> }) {
  return (
    <ul className="space-y-3" aria-label="주장 분류 비율">
      {VERDICTS.map((v) => {
        const m = VERDICT_META[v];
        return (
          <li key={v}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5" title={m.description}>
                <VerdictIcon verdict={v} className={`size-4 ${m.tw.text}`} />
                <span className="font-medium">{m.label}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold">{ratio[v]}%</span>
                <span className="ml-1 text-xs text-muted-foreground">({counts[v]}개)</span>
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label={`${m.label} 비율`}
              aria-valuenow={ratio[v]}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className={`h-full rounded-full ${m.tw.dot} transition-[width] duration-700`} style={{ width: `${ratio[v]}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
