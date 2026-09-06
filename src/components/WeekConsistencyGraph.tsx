"use client";

import { useState } from "react";
import Link from "next/link";
import {
  consistencyLevel,
  type ConsistencyDay,
} from "@/lib/consistency";
import { formatStudyDuration } from "@/lib/study-time";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function weekdayShort(iso: string) {
  return DOW[new Date(iso + "T12:00:00").getDay()];
}

function prettyDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

type LiveToday = {
  date: string;
  habitsDone: number;
  habitsTotal: number;
  tasksDone: number;
  tasksTotal: number;
  studyMinutes: number;
  wakeTime: string | null;
  wakeEarly: boolean;
  logged: boolean;
};

type Props = {
  days: ConsistencyDay[];
  today?: string;
  liveToday?: LiveToday | null;
};

export function WeekConsistencyGraph({ days, today, liveToday }: Props) {
  const merged = days.map((d) => {
    if (!liveToday || d.date !== liveToday.date) return d;
    const next = { ...d, ...liveToday };
    return { ...next, level: consistencyLevel(next) };
  });
  const [picked, setPicked] = useState<string | null>(today || null);
  const shown =
    merged.find((d) => d.date === picked) ||
    merged.find((d) => d.date === today) ||
    merged[merged.length - 1] ||
    null;
  const consistent = merged.filter((d) => d.level > 0).length;
  const habitPct = shown?.habitsTotal
    ? Math.round((shown.habitsDone / shown.habitsTotal) * 100)
    : 0;

  if (!merged.length) return null;

  return (
    <section className="ui-card !text-left">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="ui-card-label">This week</p>
          <h2 className="font-display mt-1 text-xl text-white">
            {consistent} consistent day{consistent === 1 ? "" : "s"}
          </h2>
        </div>
        <Link href="/progress" className="ui-btn-text shrink-0 text-sm">
          Full graph
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-2">
        {merged.map((cell) => {
          const on = shown?.date === cell.date;
          const fill = cell.habitsTotal
            ? Math.round((cell.habitsDone / cell.habitsTotal) * 100)
            : 0;
          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => setPicked(cell.date)}
              className="min-w-0 text-center"
              aria-pressed={on}
              aria-label={`${prettyDate(cell.date)} · ${cell.habitsDone} of ${cell.habitsTotal} habits`}
            >
              <span className="block truncate text-[10px] text-[var(--color-mist)] sm:text-[11px]">
                {weekdayShort(cell.date)}
              </span>
              <span
                className={`contrib-${cell.level} mx-auto mt-1.5 block h-7 w-7 rounded-md outline outline-white/10 sm:h-8 sm:w-8 ${
                  on ? "ring-1 ring-white/70" : ""
                }`}
              />
              <span className="mx-auto mt-1.5 flex h-8 w-1.5 items-end overflow-hidden rounded-full bg-white/10 sm:h-10">
                <span
                  className="block w-full rounded-full bg-[var(--color-dawn)]"
                  style={{
                    height: `${cell.level > 0 ? Math.max(12, fill) : 0}%`,
                  }}
                />
              </span>
            </button>
          );
        })}
      </div>

      {shown ? (
        <p className="mt-3 text-sm text-[var(--color-mist)]">
          <span className="text-white">{prettyDate(shown.date)}</span>
          {" · "}
          {shown.logged
            ? `${shown.habitsDone}/${shown.habitsTotal} habits (${habitPct}%)`
            : "No check-in"}
          {shown.tasksTotal
            ? ` · ${shown.tasksDone}/${shown.tasksTotal} tasks`
            : ""}
          {shown.studyMinutes > 0
            ? ` · ${formatStudyDuration(shown.studyMinutes)} study`
            : ""}
          {shown.wakeEarly
            ? " · wake on time"
            : shown.wakeTime
              ? ` · up ${shown.wakeTime}`
              : ""}
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-[var(--color-mist)]">
        <span className="mr-1">Less</span>
        <span className="tile contrib-0" />
        <span className="tile contrib-1" />
        <span className="tile contrib-2" />
        <span className="tile contrib-3" />
        <span className="tile contrib-4" />
        <span className="ml-1">More</span>
      </div>
    </section>
  );
}
