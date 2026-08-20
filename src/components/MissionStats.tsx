"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { MissionPctRing, MISSION_RING_EASE } from "@/components/MissionRing";
import {
  formatMissionRemaining,
  missionDoing,
  missionEndDate,
  type MissionPublic,
} from "@/lib/missions";
import { formatLocalDate } from "@/lib/habits";
import type { ReportRange } from "@/lib/progress-brief";

type Props = {
  missions: MissionPublic[];
  history?: MissionPublic[];
  range: ReportRange;
  today?: string;
};

function windowSize(range: ReportRange) {
  if (range === "today") return 1;
  if (range === "week") return 7;
  if (range === "month") return 30;
  return 365;
}

function lastNDates(n: number, today?: string): string[] {
  const out: string[] = [];
  const now = today
    ? new Date(today + "T12:00:00")
    : new Date();
  now.setHours(12, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(formatLocalDate(d));
  }
  return out;
}

function overlapDays(mission: MissionPublic, dates: string[]) {
  const end = mission.progress.ongoing
    ? dates[dates.length - 1]
    : missionEndDate(mission.startDate, mission.days);
  return dates.filter((d) => {
    if (d < mission.startDate) return false;
    if (end && d > end) return false;
    return true;
  });
}

function rangeLabel(range: ReportRange) {
  if (range === "today") return "today";
  if (range === "week") return "the last 7 days";
  if (range === "month") return "the last 30 days";
  return "this year";
}

export function MissionStats({
  missions,
  history = [],
  range,
  today,
}: Props) {
  const size = windowSize(range);
  const dates = lastNDates(size, today);
  const live = missions.filter((m) => m.active);
  const past = history.filter((m) => !m.active).slice(0, 6);
  const day = today || dates[dates.length - 1] || formatLocalDate(new Date());

  if (!live.length && !past.length) {
    return (
      <div>
        <h2 className="font-display text-2xl text-white">Missions</h2>
        <p className="mt-1 text-sm text-[var(--color-mist)]">
          Long missions (hackathon, a build, exam prep) are not on this report
          yet.{" "}
          <Link href="/settings?tab=mission" className="ui-btn-text">
            Start one
          </Link>{" "}
          and mark days on Today — they show up here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-2xl text-white">Missions</h2>
      <p className="mt-1 text-sm text-[var(--color-mist)]">
        How each mission is going — steps closed and days you showed up — not
        just the {rangeLabel(range)} window.
      </p>
      <ul className="mt-4 space-y-3">
        {live.map((m) => (
          <MissionStatCard key={m.id} mission={m} dates={dates} today={day} />
        ))}
      </ul>
      {past.length ? (
        <div className="mt-6">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-mist)]">
            Ended
          </p>
          <ul className="mt-2 space-y-2">
            {past.map((m) => {
              const doing = missionDoing(m, day);
              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 text-sm text-[var(--color-mist)]"
                >
                  <span className="text-[var(--color-cloud)]">{m.title}</span>
                  <span className="shrink-0 tabular-nums">
                    {doing.pct}% · {doing.detail}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MissionStatCard({
  mission: m,
  dates,
  today,
}: {
  mission: MissionPublic;
  dates: string[];
  today: string;
}) {
  const reduce = useReducedMotion();
  const doing = missionDoing(m, today);
  const windowDays = overlapDays(m, dates);
  const checks = new Set(m.checkDates);
  const workedInRange = windowDays.filter((d) => checks.has(d)).length;
  const showDots = dates.length <= 30 && m.kind === "manual";
  const p = m.progress;

  return (
    <li className="ui-card ui-card-compact !text-left">
      <div className="flex items-center gap-3">
        <MissionPctRing
          fill={doing.pct}
          value={doing.pct}
          caption="done"
          ariaLabel={`${m.title} ${doing.pct} percent done. ${doing.detail}`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-dawn)]">
            {m.kind === "manual" ? "Manual" : "Habit run"}
            {m.doneToday ? " · today" : ""}
          </p>
          <p className="font-display mt-1 truncate text-xl text-white">
            {m.title}
          </p>
          <p className="mt-0.5 text-sm tabular-nums text-[var(--color-mist)]">
            {formatMissionRemaining(p)}
          </p>
          <p className="mt-0.5 text-sm text-[var(--color-cloud)]">
            {doing.detail}
          </p>
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[var(--color-ember)] to-[var(--color-dawn)]"
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${doing.pct}%` }}
          transition={{ duration: reduce ? 0 : 0.9, ease: MISSION_RING_EASE }}
        />
      </div>

      {showDots ? (
        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-mist)]">
            Shown up {workedInRange}/{windowDays.length || 0} in this window
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {dates.map((d) => {
              const inWindow = windowDays.includes(d);
              const on = checks.has(d);
              return (
                <span
                  key={d}
                  title={d}
                  className={`h-2 w-2 rounded-full ${
                    on
                      ? "bg-[var(--color-dawn)]"
                      : inWindow
                        ? "bg-white/20"
                        : "bg-white/8"
                  }`}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      {m.habitStats.length ? (
        <p className="mt-2 text-xs text-[var(--color-mist)]">
          {m.habitStats.map((h) => `${h.label} ${h.daysDone}`).join(" · ")}
        </p>
      ) : null}

      {(m.steps || []).length ? (
        <ul className="mt-3 space-y-1">
          {m.steps.map((s) => (
            <li
              key={s.id}
              className={`text-sm ${
                s.done
                  ? "text-[var(--color-mist)] line-through"
                  : "text-[var(--color-cloud)]"
              }`}
            >
              {s.done ? "✓ " : "○ "}
              {s.text}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
