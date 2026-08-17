"use client";

import { useCallback, useEffect, useState } from "react";
import {
  buildCoachPlan,
  buildDaySleepReport,
  buildWeekSleepReport,
  type SleepGrade,
} from "@/lib/sleep-report";
import type { HabitLogLike } from "@/lib/habits";

type Props = {
  logs: HabitLogLike[];
  today: string;
  sleepGoal: string;
  wakeGoal: string;
};

type AiCoach = {
  headline: string;
  why: string;
  tonightBed: string;
  windDown: string;
  morningWake: string;
  steps: string[];
  pepTalk: string;
  frictionFix: string;
};

function gradeStyle(grade: SleepGrade) {
  switch (grade) {
    case "excellent":
    case "good":
      return "text-[var(--color-leaf)]";
    case "ok":
      return "text-[var(--color-dawn)]";
    case "short":
    case "late":
    case "very_late":
      return "text-[var(--color-ember)]";
    default:
      return "text-[var(--color-mist)]";
  }
}

function filterLastDays(logs: HabitLogLike[], today: string, n: number) {
  const end = new Date(today + "T12:00:00");
  return logs.filter((l) => {
    const d = new Date(l.date + "T12:00:00");
    const diff = (end.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff < n;
  });
}

export function SleepReport({ logs, today, sleepGoal, wakeGoal }: Props) {
  const todayLog = logs.find((l) => l.date === today);
  const last14 = filterLastDays(logs, today, 14);
  const last7 = filterLastDays(logs, today, 7);
  const day = buildDaySleepReport(
    todayLog,
    today,
    sleepGoal,
    wakeGoal,
    last14
  );
  const week = buildWeekSleepReport(last7, sleepGoal, wakeGoal);
  const localCoach = buildCoachPlan(last14, sleepGoal, wakeGoal);

  const [aiConfigured, setAiConfigured] = useState(false);
  const [ai, setAi] = useState<AiCoach | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    void fetch("/api/coach")
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => {
        setAiConfigured(Boolean(d.configured));
      })
      .catch(() => setAiConfigured(false));
  }, []);

  const runAi = useCallback(async () => {
    setAiLoading(true);
    setAiError("");
    const res = await fetch("/api/coach", { method: "POST" });
    const data = await res.json();
    setAiLoading(false);
    if (!res.ok) {
      setAiError(data.error || "AI failed");
      return;
    }
    setAi(data.coach);
  }, []);

  const coach = ai
    ? {
        headline: ai.headline,
        why: ai.why,
        tonightBed: ai.tonightBed,
        windDown: ai.windDown,
        morningWake: ai.morningWake,
        steps: ai.steps,
      }
    : localCoach;

  return (
    <div className="mt-8 space-y-8 sm:mt-10 sm:space-y-10">
      <section className="ui-card">
        <p className="ui-kicker">Today</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p
              className={`font-display text-4xl leading-none sm:text-5xl ${gradeStyle(day.grade)}`}
            >
              {day.score > 0 ? day.score : "—"}
            </p>
            <p className="mt-2 text-base text-white">{day.label}</p>
          </div>
          <p className="max-w-sm text-sm text-[var(--color-mist)]">
            {day.summary}
          </p>
        </div>
        {day.highlights.length > 0 && (
          <p className="mt-4 font-mono text-sm text-[var(--color-cloud)]">
            {day.highlights.join(" · ")}
          </p>
        )}
        {day.actions[0] && (
          <p className="mt-4 border-l-2 border-[var(--color-dawn)] pl-4 text-sm text-[var(--color-cloud)]">
            <span className="text-[var(--color-dawn)]">Next · </span>
            {day.actions[0]}
          </p>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="ui-kicker">Tonight</p>
            <h2 className="ui-section-title mt-2 text-[1.5rem] sm:text-2xl">
              {coach.headline}
            </h2>
          </div>
          {aiConfigured && (
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => void runAi()}
              className="ui-chip"
            >
              {aiLoading
                ? "Thinking…"
                : ai
                  ? "Refresh plan"
                  : "Personalize with AI"}
            </button>
          )}
        </div>
        <p className="ui-sub mt-3">{coach.why}</p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <PlanTime label="Wind-down" value={coach.windDown} />
          <PlanTime label="In bed" value={coach.tonightBed} />
          <PlanTime label="Wake" value={coach.morningWake} />
        </div>

        <ol className="mt-5 max-w-xl space-y-2.5">
          {coach.steps.slice(0, 4).map((s, i) => (
            <li
              key={`${i}-${s}`}
              className="flex gap-3 text-sm text-[var(--color-cloud)]"
            >
              <span className="font-mono text-[var(--color-dawn)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>

        {ai?.pepTalk && (
          <p className="mt-4 max-w-xl text-sm italic text-[var(--color-mist)]">
            {ai.pepTalk}
          </p>
        )}
        {aiError && <p className="mt-3 text-sm text-red-300">{aiError}</p>}
      </section>

      <section>
        <p className="ui-kicker">Last 7 days</p>
        <h2 className="ui-section-title mt-2">The week</h2>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Logged" value={String(week.daysLogged)} />
          <Stat label="Bed on time" value={`${week.onTimeRate}%`} />
          <Stat label="Wake on time" value={`${week.wakeOnTimeRate}%`} />
          <Stat label="Consistency" value={String(week.consistencyScore)} />
          <Stat
            label="Avg sleep"
            value={
              week.avgDurationHours != null ? `${week.avgDurationHours}h` : "—"
            }
          />
          <Stat
            label="Sleep debt"
            value={week.sleepDebtHours > 0 ? `${week.sleepDebtHours}h` : "0h"}
          />
        </div>
        {week.tips[0] && (
          <p className="mt-4 max-w-xl text-sm text-[var(--color-mist)]">
            {week.tips[0]}
          </p>
        )}
      </section>
    </div>
  );
}

function PlanTime({ label, value }: { label: string; value: string }) {
  return (
    <div className="ui-card ui-card-compact !text-left">
      <p className="ui-card-label">{label}</p>
      <p className="font-display mt-1 text-xl text-[var(--color-dawn)] sm:text-2xl">
        {value}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="ui-card ui-card-compact !text-left">
      <p className="ui-card-label">{label}</p>
      <p className="font-display mt-1 text-xl text-white sm:text-2xl">{value}</p>
    </div>
  );
}
