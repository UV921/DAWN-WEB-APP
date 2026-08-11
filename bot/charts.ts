/**
 * Clear, readable chart images for Dawn Discord reports (QuickChart).
 */

import { AttachmentBuilder } from "discord.js";

export type DayScore = {
  date: string;
  label: string;
  onTrack: number;
  woke: number;
  total: number;
  pct: number; // on-track %
  wakePct: number;
};

export type MemberBar = {
  name: string;
  pct: number;
  streak: number;
  wakeTime: string | null;
  todosDone: number;
  todosTotal: number;
  onTrack: boolean;
};

function shortDay(date: string) {
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

export function lastNDates(n: number, end = new Date()) {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
  }
  return out;
}

/** 14-day: woke % + on-track % — always shows something useful */
export function crewConsistencyChartConfig(days: DayScore[]) {
  const labels = days.map((d) => shortDay(d.date));
  return {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Woke %",
          data: days.map((d) => d.wakePct),
          backgroundColor: "#22c55e",
          borderRadius: 5,
          maxBarThickness: 22,
        },
        {
          label: "On-track %",
          data: days.map((d) => d.pct),
          backgroundColor: "#f59e0b",
          borderRadius: 5,
          maxBarThickness: 22,
        },
      ],
    },
    options: {
      layout: { padding: 14 },
      plugins: {
        title: {
          display: true,
          text: "Last 14 days",
          font: { size: 20, weight: "bold" },
          color: "#1c1917",
        },
        subtitle: {
          display: true,
          text: "Green = % who woke   ·   Amber = % who woke + finished todos",
          color: "#78716c",
          font: { size: 12 },
          padding: { bottom: 10 },
        },
        legend: {
          position: "bottom",
          labels: { color: "#44403c", font: { size: 12 }, boxWidth: 14 },
        },
      },
      scales: {
        x: {
          ticks: { color: "#57534e", font: { size: 11 } },
          grid: { display: false },
        },
        y: {
          min: 0,
          max: 100,
          ticks: {
            color: "#57534e",
            stepSize: 25,
            callback: (v: number) => `${v}%`,
          },
          grid: { color: "rgba(0,0,0,0.06)" },
        },
      },
    },
  };
}

/**
 * Today roster — grouped bars everyone can read:
 *  Green = woke (100/0) · Colored = todos %
 */
export function memberBarsChartConfig(members: MemberBar[], title: string) {
  const sorted = [...members].sort((a, b) => {
    if (Boolean(a.wakeTime) !== Boolean(b.wakeTime))
      return a.wakeTime ? -1 : 1;
    return b.pct - a.pct;
  });

  const labels = sorted.map((m) => {
    const n = m.name.length > 11 ? m.name.slice(0, 10) + "…" : m.name;
    const tag = m.wakeTime ? m.wakeTime : "asleep";
    return `${n} (${tag})`;
  });

  return {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Woke (yes=100)",
          data: sorted.map((m) => (m.wakeTime ? 100 : 0)),
          backgroundColor: "#16a34a",
          borderRadius: 6,
          maxBarThickness: 28,
        },
        {
          label: "Todos done %",
          data: sorted.map((m) =>
            m.todosTotal > 0
              ? m.pct
              : m.wakeTime
                ? 0
                : 0
          ),
          backgroundColor: "#ea580c",
          borderRadius: 6,
          maxBarThickness: 28,
        },
      ],
    },
    options: {
      indexAxis: "y",
      layout: { padding: { top: 10, right: 24, bottom: 10, left: 10 } },
      plugins: {
        title: {
          display: true,
          text: title,
          font: { size: 18, weight: "bold" },
          color: "#1c1917",
        },
        subtitle: {
          display: true,
          text: "Green bar = woke up · Orange bar = % of todos finished",
          color: "#78716c",
          font: { size: 12 },
          padding: { bottom: 8 },
        },
        legend: {
          position: "bottom",
          labels: { color: "#44403c", font: { size: 12 }, boxWidth: 14 },
        },
      },
      scales: {
        x: {
          min: 0,
          max: 100,
          ticks: {
            color: "#57534e",
            callback: (v: number) => `${v}%`,
            font: { size: 11 },
          },
          grid: { color: "rgba(0,0,0,0.06)" },
        },
        y: {
          ticks: { color: "#1c1917", font: { size: 12, weight: "bold" } },
          grid: { display: false },
        },
      },
    },
  };
}

/** Light background — reads better in Discord */
export function quickChartUrl(config: object, width: number, height: number) {
  const c = encodeURIComponent(JSON.stringify(config));
  return `https://quickchart.io/chart?w=${width}&h=${height}&devicePixelRatio=2&bkg=white&f=png&c=${c}`;
}

export async function chartAttachment(
  config: object,
  filename: string,
  width = 900,
  height = 480
): Promise<AttachmentBuilder | null> {
  try {
    const url = quickChartUrl(config, width, height);
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.error("QuickChart HTTP", res.status, await res.text().catch(() => ""));
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500) return null;
    return new AttachmentBuilder(buf, { name: filename });
  } catch (e) {
    console.error("chartAttachment failed", e);
    return null;
  }
}
