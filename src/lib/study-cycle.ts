import { DEFAULT_TZ, zonedClock } from "./clock";
import { MAX_SESSION_MS, formatStudyDuration } from "./study-time";

export const HOURS_IN_DAY = 24;

export type HourMinutes = number[];

export type StudySessionSpan = {
  startedAt: Date;
  endedAt: Date | null;
};

export type HourlyRow = { date: string; hours: number[] };

export type HourWindow = { start: number; end: number; minutes: number };

export type StudyBandKey = "night" | "morning" | "afternoon" | "evening";

export const STUDY_BANDS: {
  key: StudyBandKey;
  label: string;
  hint: string;
  start: number;
  end: number;
}[] = [
  { key: "night", label: "Night", hint: "12–6am", start: 0, end: 6 },
  { key: "morning", label: "Morning", hint: "6am–12pm", start: 6, end: 12 },
  { key: "afternoon", label: "Afternoon", hint: "12–6pm", start: 12, end: 18 },
  { key: "evening", label: "Evening", hint: "6pm–12am", start: 18, end: 24 },
];

export function emptyHours(): HourMinutes {
  return Array.from({ length: HOURS_IN_DAY }, () => 0);
}

/** Split each session across local hours (and dates) in `timeZone`. */
export function minutesByHourByDate(
  sessions: StudySessionSpan[],
  timeZone: string,
  now = new Date()
): Map<string, HourMinutes> {
  const tz = timeZone || DEFAULT_TZ;
  const byDate = new Map<string, HourMinutes>();

  for (const s of sessions) {
    const start = s.startedAt.getTime();
    if (!Number.isFinite(start)) continue;
    const rawEnd = (s.endedAt ?? now).getTime();
    const end = Math.min(
      Number.isFinite(rawEnd) ? rawEnd : now.getTime(),
      start + MAX_SESSION_MS
    );
    if (end <= start) continue;

    let t = start;
    let steps = 0;
    while (t < end && steps < 400) {
      steps += 1;
      const clock = zonedClock(tz, new Date(t));
      const hour = Math.min(23, Math.max(0, Math.floor(clock.mins / 60)));
      const minsIntoHour = clock.mins % 60;
      const remainMs = Math.max(1, (60 - minsIntoHour) * 60_000);
      const chunk = Math.min(remainMs, end - t);
      let hours = byDate.get(clock.date);
      if (!hours) {
        hours = emptyHours();
        byDate.set(clock.date, hours);
      }
      hours[hour] += chunk / 60_000;
      t += chunk;
    }
  }

  return byDate;
}

export function serializeHourly(byDate: Map<string, HourMinutes>): HourlyRow[] {
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, hours]) => ({
      date,
      hours: hours.map((m) => Math.round(m * 10) / 10),
    }));
}

export function sumHourlyRows(
  rows: HourlyRow[],
  dates?: Set<string>
): HourMinutes {
  const hours = emptyHours();
  for (const row of rows) {
    if (dates && !dates.has(row.date)) continue;
    const n = Math.min(HOURS_IN_DAY, row.hours.length);
    for (let h = 0; h < n; h++) hours[h] += row.hours[h] || 0;
  }
  return hours;
}

export function formatHourLabel(hour: number): string {
  const h = ((Math.round(hour) % 24) + 24) % 24;
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  if (h < 12) return `${h}am`;
  return `${h - 12}pm`;
}

/** `end` is exclusive (0–24, or 0 when a window wraps past midnight). */
export function formatHourRange(start: number, end: number): string {
  return `${formatHourLabel(start)}–${formatHourLabel(end)}`;
}

export function peakHour(hours: HourMinutes): number | null {
  let bestH = -1;
  let best = 0;
  for (let h = 0; h < HOURS_IN_DAY; h++) {
    if (hours[h] > best) {
      best = hours[h];
      bestH = h;
    }
  }
  return best <= 0 ? null : bestH;
}

export function rollingHourWindow(
  hours: HourMinutes,
  width: number,
  mode: "max" | "min"
): HourWindow | null {
  const total = hours.reduce((a, n) => a + n, 0);
  if (total <= 0 || width <= 0) return null;
  let bestStart = 0;
  let best = mode === "max" ? -1 : Infinity;
  for (let i = 0; i < HOURS_IN_DAY; i++) {
    let sum = 0;
    for (let k = 0; k < width; k++) sum += hours[(i + k) % HOURS_IN_DAY] || 0;
    if (mode === "max" ? sum > best : sum < best) {
      best = sum;
      bestStart = i;
    }
  }
  return {
    start: bestStart,
    end: (bestStart + width) % HOURS_IN_DAY,
    minutes: best,
  };
}

export type StudyBandStat = {
  key: StudyBandKey;
  label: string;
  hint: string;
  minutes: number;
  pct: number;
};

export type StudyCycleInsight = {
  total: number;
  hours: HourMinutes;
  peakHour: number | null;
  peakWindow: HourWindow | null;
  quietWindow: HourWindow | null;
  peakBand: StudyBandStat | null;
  bands: StudyBandStat[];
  headline: string;
  body: string;
};

function bandStats(hours: HourMinutes): StudyBandStat[] {
  const total = hours.reduce((a, n) => a + n, 0);
  return STUDY_BANDS.map((b) => {
    let minutes = 0;
    for (let h = b.start; h < b.end; h++) minutes += hours[h] || 0;
    return {
      key: b.key,
      label: b.label,
      hint: b.hint,
      minutes,
      pct: total > 0 ? Math.round((minutes / total) * 100) : 0,
    };
  });
}

export function studyCycleInsight(hours: HourMinutes): StudyCycleInsight {
  const total = hours.reduce((a, n) => a + n, 0);
  const bands = bandStats(hours);
  const ranked = [...bands].sort((a, b) => b.minutes - a.minutes);
  const peakBand = ranked[0] && ranked[0].minutes > 0 ? ranked[0] : null;
  const peakWindow = rollingHourWindow(hours, 3, "max");
  const quietWindow = rollingHourWindow(hours, 3, "min");
  const topHour = peakHour(hours);

  if (total <= 0) {
    return {
      total: 0,
      hours,
      peakHour: null,
      peakWindow: null,
      quietWindow: null,
      peakBand: null,
      bands,
      headline: "No study hours in this window yet.",
      body: "Start a session in the morning — or whenever you sit down — and this clock fills in. Bright hours are when you study. Dim hours are when you don’t.",
    };
  }

  const when = peakWindow
    ? formatHourRange(peakWindow.start, peakWindow.end)
    : topHour != null
      ? formatHourLabel(topHour)
      : "";
  const headline = peakBand
    ? `You study most in the ${peakBand.label.toLowerCase()} · ${when}`
    : `Peak stretch ${when}`;

  const parts: string[] = [];
  if (
    quietWindow &&
    peakWindow &&
    quietWindow.minutes < peakWindow.minutes * 0.4
  ) {
    parts.push(
      `Quietest stretch is ${formatHourRange(quietWindow.start, quietWindow.end)}.`
    );
  } else {
    parts.push("Time is spread through the day — no strong dead zone yet.");
  }
  const second = ranked[1];
  if (second && second.pct >= 20 && second.key !== peakBand?.key) {
    parts.push(`${second.label} is next (${second.pct}%).`);
  }
  parts.push(`Total in this cycle: ${formatStudyDuration(total)}.`);

  return {
    total,
    hours,
    peakHour: topHour,
    peakWindow,
    quietWindow,
    peakBand,
    bands,
    headline,
    body: parts.join(" "),
  };
}
