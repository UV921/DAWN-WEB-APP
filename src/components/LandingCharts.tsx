"use client";

import { motion, useReducedMotion } from "motion/react";
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

const DEMO: LandingPoint[] = [
  { date: "d1", label: "1", habitPct: 40, taskPct: 25 },
  { date: "d2", label: "2", habitPct: 80, taskPct: 50 },
  { date: "d3", label: "3", habitPct: 20, taskPct: null },
  { date: "d4", label: "4", habitPct: 100, taskPct: 75 },
  { date: "d5", label: "5", habitPct: 60, taskPct: 40 },
  { date: "d6", label: "6", habitPct: 0, taskPct: null },
  { date: "d7", label: "7", habitPct: 90, taskPct: 80 },
  { date: "d8", label: "8", habitPct: 55, taskPct: 30 },
  { date: "d9", label: "9", habitPct: 70, taskPct: 60 },
  { date: "d10", label: "10", habitPct: 45, taskPct: 20 },
  { date: "d11", label: "11", habitPct: 85, taskPct: 90 },
  { date: "d12", label: "12", habitPct: 35, taskPct: 15 },
  { date: "d13", label: "13", habitPct: 75, taskPct: 55 },
  { date: "d14", label: "14", habitPct: 95, taskPct: 70 },
];

export function LandingCharts({ series }: { series: LandingPoint[] }) {
  const reduce = useReducedMotion();
  const live = series.some((d) => d.habitPct > 0 || d.taskPct);
  const data = live && series.length >= 3 ? series : DEMO;

  return (
    <motion.div
      className="h-[300px] w-full sm:h-[340px]"
      initial={reduce ? false : { opacity: 0.4 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
    >
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
        <EvilComposedChart.Tooltip />
        <EvilComposedChart.Bar dataKey="habitPct" variant="gradient" />
        <EvilComposedChart.Line dataKey="taskPct" glow connectNulls={false}>
          <EvilComposedChart.Dot variant="border" />
          <EvilComposedChart.ActiveDot variant="colored-border" />
        </EvilComposedChart.Line>
      </EvilComposedChart>
    </motion.div>
  );
}
