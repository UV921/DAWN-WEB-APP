"use client";

import { useCallback, useEffect, useState } from "react";
import {
  buildCoachPlan,
  buildDaySleepReport,
  buildNightLogReports,
  buildNightNeedTake,
  buildWeekSleepReport,
  type NightNeedStatus,
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

function statusTone(status: NightNeedStatus) {
  switch (status) {
    case "strong":
    case "on_plan":
      return "text-[var(--color-leaf)]";
    case "minimum":
      return "text-[var(--color-dawn)]";
    case "short":
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

function hoursText(n: number | null) {
  return n == null ? "—" : `${n}h`;
}

function pctOf(value: number, max: number) {
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
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
  const need = buildNightNeedTake(logs, today, sleepGoal, wakeGoal);
  const nights = buildNightLogReports(logs, today, sleepGoal, wakeGoal, 7);
  const localCoach = buildCoachPlan(last14, sleepGoal, wakeGoal);
  const barMax = Math.max(need.targetHours, need.plannedHours, 9);

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
        <p className="ui-kicker">Night</p>
        <h2 className="ui-section-title mt-2 text-[1.5rem] sm:text-2xl">
          Need vs take
        </h2>
        <p className="ui-sub mt-2">{need.gapLine}</p>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="Minimum"
            value={`${need.minHours}h`}
            hint="Floor most adults need"
            tone={
              need.vsMinHours != null && need.vsMinHours < 0
                ? "bad"
                : need.takeHours != null
                  ? "good"
                  : "muted"
            }
          />
          <Stat
            label="Your plan"
            value={`${need.plannedHours}h`}
            hint={`${sleepGoal} → ${wakeGoal}`}
          />
          <Stat
            label="Last night"
            value={hoursText(need.lastNightHours)}
            hint={
              need.lastNightHours == null
                ? "Log last bedtime and this wake"
                : need.vsMinHours == null
                  ? need.takeHeadline
                  : need.vsMinHours >= 0
                    ? `${need.vsMinHours}h over the ${need.minHours}h minimum`
                    : `${Math.abs(need.vsMinHours)}h under the ${need.minHours}h minimum`
            }
            tone={
              need.status === "short"
                ? "bad"
                : need.status === "strong" || need.status === "on_plan"
                  ? "good"
                  : "muted"
            }
          />
          <Stat
            label="Week avg"
            value={hoursText(need.weekAvgHours)}
            hint={
              need.sleepDebtHours > 0
                ? `${need.sleepDebtHours}h debt vs ${need.targetHours}h`
                : `${need.targetHours}h target`
            }
          />
        </div>

        <NeedTakeBar
          min={need.minHours}
          plan={need.plannedHours}
          target={need.targetHours}
          take={need.takeHours}
          max={barMax}
        />

        <p className={`mt-4 text-sm ${statusTone(need.status)}`}>
          {need.needHeadline}
          {need.nightsLogged
            ? ` · ${need.nightsAtOrAboveMin}/${need.nightsLogged} nights hit the minimum`
            : ""}
        </p>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="ui-kicker">Suggestion</p>
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
        <p className="ui-sub mt-3">{need.suggestion}</p>
        <p className="mt-2 max-w-xl text-sm text-[var(--color-mist)]">
          {coach.why}
        </p>

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

      <section className="ui-card">
        <p className="ui-kicker">Report</p>
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

        <p className="mt-6 text-[10px] uppercase tracking-[0.16em] text-[var(--color-mist)]">
          Last 7 nights
        </p>
        <ul className="mt-3 grid grid-cols-7 gap-1.5">
          {nights.map((n) => {
            const fill = n.hours == null ? 0 : pctOf(n.hours, barMax);
            const color =
              n.hours == null
                ? "bg-white/15"
                : n.metMin
                  ? "bg-[var(--color-dawn)]"
                  : "bg-[var(--color-ember)]";
            return (
              <li key={n.date} className="text-center">
                <div className="flex h-16 items-end justify-center rounded-lg bg-white/[0.04] px-1 py-1">
                  <div
                    className={`w-full rounded-sm ${color}`}
                    style={{ height: `${Math.max(n.hours == null ? 8 : 12, fill)}%` }}
                    title={
                      n.hours == null
                        ? `${n.weekday}: not logged`
                        : `${n.weekday}: ${n.hours}h`
                    }
                  />
                </div>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-[var(--color-mist)]">
                  {n.weekday.slice(0, 2)}
                </p>
                <p className="font-mono text-[10px] tabular-nums text-[var(--color-cloud)]">
                  {n.hours == null ? "—" : n.hours}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <p className="ui-kicker">Stats</p>
        <h2 className="ui-section-title mt-2">The week</h2>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Logged" value={String(week.daysLogged)} />
          <Stat label="Bed on time" value={`${week.onTimeRate}%`} />
          <Stat label="Wake on time" value={`${week.wakeOnTimeRate}%`} />
          <Stat label="Consistency" value={String(week.consistencyScore)} />
          <Stat
            label="Avg take"
            value={
              week.avgDurationHours != null ? `${week.avgDurationHours}h` : "—"
            }
            hint={`Need ${need.plannedHours}h · min ${need.minHours}h`}
          />
          <Stat
            label="Sleep debt"
            value={week.sleepDebtHours > 0 ? `${week.sleepDebtHours}h` : "0h"}
            hint={`vs ${need.targetHours}h target`}
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

function NeedTakeBar({
  min,
  plan,
  target,
  take,
  max,
}: {
  min: number;
  plan: number;
  target: number;
  take: number | null;
  max: number;
}) {
  const takePct = take == null ? 0 : pctOf(take, max);
  const short = take != null && take < min;
  return (
    <div className="mt-5">
      <div className="relative h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${
            short ? "bg-[var(--color-ember)]" : "bg-[var(--color-dawn)]"
          }`}
          style={{ width: `${takePct}%` }}
        />
        <span
          className="absolute top-0 h-full w-px bg-white/70"
          style={{ left: `${pctOf(min, max)}%` }}
          aria-hidden
        />
        <span
          className="absolute top-0 h-full w-px bg-[var(--color-dawn)]/80"
          style={{ left: `${pctOf(plan, max)}%` }}
          aria-hidden
        />
        {Math.abs(target - plan) >= 0.4 ? (
          <span
            className="absolute top-0 h-full w-px bg-white/40"
            style={{ left: `${pctOf(target, max)}%` }}
            aria-hidden
          />
        ) : null}
      </div>
      <div className="relative mt-1.5 h-4 text-[10px] uppercase tracking-wide text-[var(--color-mist)]">
        <span
          className="absolute -translate-x-1/2"
          style={{ left: `${pctOf(min, max)}%` }}
        >
          {Math.abs(plan - min) < 0.3 ? `min/plan ${min}h` : `min ${min}h`}
        </span>
        {Math.abs(plan - min) >= 0.3 ? (
          <span
            className="absolute -translate-x-1/2 text-[var(--color-dawn)]"
            style={{ left: `${pctOf(plan, max)}%` }}
          >
            plan {plan}h
          </span>
        ) : null}
        {Math.abs(target - plan) >= 0.4 && Math.abs(target - min) >= 0.4 ? (
          <span
            className="absolute -translate-x-1/2"
            style={{ left: `${pctOf(target, max)}%` }}
          >
            {target}h
          </span>
        ) : null}
      </div>
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

function Stat({
  label,
  value,
  hint,
  tone = "muted",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "muted" | "good" | "bad";
}) {
  const valueCls =
    tone === "good"
      ? "text-[var(--color-leaf)]"
      : tone === "bad"
        ? "text-[var(--color-ember)]"
        : "text-white";
  return (
    <div className="ui-card ui-card-compact !text-left">
      <p className="ui-card-label">{label}</p>
      <p className={`font-display mt-1 text-xl sm:text-2xl ${valueCls}`}>
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[11px] leading-snug text-[var(--color-mist)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
