"use client";

import { type ChartConfig } from "@/components/evilcharts/ui/recharts-chart";
import { EvilBarChart } from "@/components/evilcharts/charts/recharts-bar-chart";
import { EvilComposedChart } from "@/components/evilcharts/charts/recharts-composed-chart";

const DAWN = ["#f0b45a"];
const LEAF = ["#6fbf8a"];
const STUDY = ["#6ea8d8"];

function series(label: string, colors: string[]) {
  return { label, colors: { light: colors, dark: colors } };
}

export type CompareRow = {
  name: string;
  Day: number;
  Average: number;
};

export function DayVsAverageChart({ data }: { data: CompareRow[] }) {
  const config = {
    Day: series("This day", DAWN),
    Average: series("Last 7 days", LEAF),
  } satisfies ChartConfig;

  return (
    <div className="h-[220px] w-full">
      <EvilBarChart
        data={data}
        config={config}
        className="h-full w-full aspect-auto p-1"
        xDataKey="name"
      >
        <EvilBarChart.Grid />
        <EvilBarChart.XAxis dataKey="name" />
        <EvilBarChart.YAxis
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
        />
        <EvilBarChart.Legend isClickable />
        <EvilBarChart.Tooltip />
        <EvilBarChart.Bar dataKey="Day" variant="gradient" />
        <EvilBarChart.Bar dataKey="Average" variant="gradient" />
      </EvilBarChart>
    </div>
  );
}

export type TrendPoint = {
  date: string;
  label: string;
  Habits: number;
  Tasks: number;
  Study: number;
};

export function ProgressTrendChart({ data }: { data: TrendPoint[] }) {
  const config = {
    Habits: series("Habits", DAWN),
    Tasks: series("Tasks", LEAF),
    Study: series("Study", STUDY),
  } satisfies ChartConfig;

  return (
    <div className="h-[260px] w-full">
      <EvilComposedChart
        data={data}
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
        <EvilComposedChart.Legend isClickable />
        <EvilComposedChart.Tooltip />
        <EvilComposedChart.Bar dataKey="Habits" variant="gradient" />
        <EvilComposedChart.Bar dataKey="Tasks" variant="gradient" />
        <EvilComposedChart.Line dataKey="Study" glow>
          <EvilComposedChart.Dot variant="border" />
          <EvilComposedChart.ActiveDot variant="colored-border" />
        </EvilComposedChart.Line>
      </EvilComposedChart>
    </div>
  );
}
