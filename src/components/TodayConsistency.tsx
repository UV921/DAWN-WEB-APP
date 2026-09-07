"use client";

import { useState } from "react";
import Link from "next/link";
import { completedCount, type HabitDef, type HabitLogLike } from "@/lib/habits";

type Props = {
  logs: HabitLogLike[];
  habits: HabitDef[];
  today: string;
  checks: Record<string, boolean>;
  wakeTime: string;
};

export function TodayConsistency({ logs, habits, today, checks, wakeTime }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const keys = habits.filter((habit) => habit.active !== false).map((habit) => habit.key);
  const byDate = new Map(logs.map((log) => [log.date, log]));
  // Use the account's calendar date, including when its timezone differs from the device.
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 41 + index);
    const key = date.toISOString().slice(0, 10);
    const log = key === today
      ? { date: key, checks, wakeTime: wakeTime || null, bedtime: null }
      : byDate.get(key);
    const done = log && keys.length ? completedCount(log, keys) : 0;
    const percent = keys.length ? Math.round(done / keys.length * 100) : 0;
    return { date: key, done, percent };
  });
  const active = days.find((day) => day.date === selected) || days[41];
  const activeDays = days.filter((day) => day.done > 0).length;
  const label = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <section className="w-full min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5" aria-labelledby="today-consistency-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="today-consistency-title" className="text-sm font-medium text-white">Consistency</h2>
          <p className="mt-1 text-xs text-[var(--color-mist)]">Last 6 weeks · {activeDays} days with habits completed</p>
        </div>
        <Link href="/progress" className="text-xs text-[var(--color-dawn)] underline-offset-4 hover:underline">View progress →</Link>
      </div>
      <div className="mt-4 grid grid-cols-[repeat(21,minmax(0,1fr))] gap-1 sm:grid-cols-[repeat(42,minmax(0,1fr))]" aria-label="Daily habit completion, oldest to newest">
        {days.map((day) => (
          <button
            key={day.date}
            type="button"
            onClick={() => setSelected(day.date)}
            onFocus={() => setSelected(day.date)}
            aria-pressed={active.date === day.date}
            aria-label={`${label(day.date)}: ${day.done} of ${keys.length} habits completed${day.date === today ? ", today so far" : ""}`}
            title={`${label(day.date)} · ${day.percent}%`}
            className="flex h-9 min-w-0 items-end rounded-sm bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-dawn)]"
            style={{ outline: active.date === day.date ? "1px solid var(--color-dawn)" : undefined, outlineOffset: 2 }}
          >
            <span className="w-full rounded-sm bg-[var(--color-dawn)]" style={{ height: `${Math.max(5, day.percent)}%`, opacity: day.percent ? 0.35 + day.percent / 155 : 0.15 }} />
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-[var(--color-mist)]"><span>{label(days[0].date)}</span><span>Today</span></div>
      <p className="mt-2 text-xs text-[var(--color-mist)]" aria-live="polite">
        {activeDays === 0 ? "Complete your first habit to start filling your graph. " : ""}
        {active.date === today ? "Today so far" : label(active.date)}: {active.done}/{keys.length} habits · {active.percent}%
      </p>
    </section>
  );
}
