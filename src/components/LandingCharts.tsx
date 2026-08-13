"use client";

import { EvilComposedChart } from "@/components/evilcharts/charts/recharts-composed-chart";
import { type ChartConfig } from "@/components/evilcharts/ui/recharts-chart";
import type { LandingPoint } from "@/lib/landing-data";

const config = {
  habitPct: {
    label: "Habits",
    colors: { light: ["#f0b45a"], dark: ["#f0b45a"] },
  },
  taskPct: {
    label: "Tasks",
    colors: { light: ["#6fbf8a"], dark: ["#6fbf8a"] },
  },
} satisfies ChartConfig;

export function LandingCharts({ series }: { series: LandingPoint[] }) {
  if (series.length < 3) return null;

  return (
    <div className="h-[260px] w-full">
      <EvilComposedChart
        data={series}
        config={config}
        className="h-full w-full aspect-auto p-1"
        xDataKey="label"
      >
        <EvilComposedChart.Grid />
        <EvilComposedChart.XAxis dataKey="label" />
        <EvilComposedChart.YAxis
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
        />
        <EvilComposedChart.Legend />
        <EvilComposedChart.Tooltip />
        <EvilComposedChart.Bar dataKey="habitPct" variant="gradient" />
        <EvilComposedChart.Line dataKey="taskPct" glow connectNulls={false}>
          <EvilComposedChart.Dot variant="border" />
          <EvilComposedChart.ActiveDot variant="colored-border" />
        </EvilComposedChart.Line>
      </EvilComposedChart>
    </div>
  );
}
