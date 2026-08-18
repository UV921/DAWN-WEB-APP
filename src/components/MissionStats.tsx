"use client";

import Link from "next/link";
import { formatMissionDay, missionEndDate, type MissionPublic } from "@/lib/missions";
import { formatLocalDate } from "@/lib/habits";
import type { ReportRange } from "@/lib/progress-brief";

type Props = {
  missions: MissionPublic[];
  history?: MissionPublic[];
  range: ReportRange;
};

function windowSize(range: ReportRange) {
  if (range === "today") return 1;
  if (range === "week") return 7;
  if (range === "month") return 30;
  return 365;
}

function lastNDates(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
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

export function MissionStats({ missions, history = [], range }: Props) {
  const size = windowSize(range);
  const dates = lastNDates(size);
  const live = missions.filter((m) => m.active);
  const past = history.filter((m) => !m.active).slice(0, 6);

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
        Days you marked you worked, for {rangeLabel(range)}. Habit runs also
        count the habits tied to them.
      </p>
      <ul className="mt-4 space-y-3">
        {live.map((m) => (
          <MissionStatCard key={m.id} mission={m} dates={dates} />
        ))}
      </ul>
      {past.length ? (
        <div className="mt-6">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-mist)]">
            Ended
          </p>
          <ul className="mt-2 space-y-2">
            {past.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between text-sm text-[var(--color-mist)]"
              >
                <span className="text-[var(--color-cloud)]">{m.title}</span>
                <span>
                  {m.daysWorked} day{m.daysWorked === 1 ? "" : "s"} worked
                  {m.days ? ` · ${m.days}d` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MissionStatCard({
  mission: m,
  dates,
}: {
  mission: MissionPublic;
  dates: string[];
}) {
  const windowDays = overlapDays(m, dates);
  const checks = new Set(m.checkDates);
  const worked = windowDays.filter((d) => checks.has(d)).length;
  const denom = Math.max(1, windowDays.length);
  const pct = Math.round((worked / denom) * 100);
  const habitHits = m.habitStats.length
    ? Math.round(
        (m.habitStats.reduce((a, h) => a + h.daysDone, 0) /
          Math.max(1, m.habitStats.length * Math.max(1, m.progress.day))) *
          100
      )
    : null;
  const showDots = dates.length <= 30;

  return (
    <li className="ui-card ui-card-compact !text-left">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-dawn)]">
            {m.kind === "manual" ? "Manual" : "Habit run"}
            {m.doneToday ? " · today" : ""}
          </p>
          <p className="font-display mt-1 text-xl text-white">{m.title}</p>
          <p className="mt-0.5 text-sm text-[var(--color-mist)]">
            {formatMissionDay(m.progress)}
            {m.kind === "manual"
              ? ` · ${worked}/${windowDays.length || 0} days worked in this window`
              : ""}
          </p>
        </div>
        <p className="font-display text-2xl tabular-nums text-white">
          {m.kind === "manual" ? `${pct}%` : `${m.progress.day}${m.progress.ongoing ? "" : `/${m.progress.total}`}`}
        </p>
      </div>
      {showDots && m.kind === "manual" ? (
        <div className="mt-3 flex flex-wrap gap-1">
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
      ) : (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--color-dawn)]"
            style={{
              width: `${
                m.kind === "manual"
                  ? pct
                  : m.progress.ongoing
                    ? 8
                    : Math.min(
                        100,
                        Math.round(
                          (m.progress.day / Math.max(1, m.progress.total)) * 100
                        )
                      )
              }%`,
            }}
          />
        </div>
      )}
      {habitHits != null ? (
        <p className="mt-2 text-xs text-[var(--color-mist)]">
          Linked habits {habitHits}% over the mission so far
          {m.habitStats.length
            ? ` · ${m.habitStats.map((h) => `${h.label} ${h.daysDone}`).join(" · ")}`
            : ""}
        </p>
      ) : null}
    </li>
  );
}
