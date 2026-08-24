"use client";

import Link from "next/link";
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
} from "@/components/icons";
import {
  addCalendarDays,
  clampDayIso,
  prettyDayLong,
  weekdayShort,
  type DayHabitHit,
  type DayRatio,
  type DayStripCell,
} from "@/lib/day-progress";
import { RatioRing, RatioRow } from "@/components/RatioRing";
import {
  DayVsAverageChart,
  type CompareRow,
} from "@/components/ProgressTrendChart";

type Props = {
  date: string;
  today: string;
  onDate: (date: string) => void;
  score: number | null;
  ratios: DayRatio[];
  habits: DayHabitHit[];
  compare: CompareRow[];
  strip: DayStripCell[];
  notes?: string | null;
  goalText?: string | null;
};

export function DayProgressPanel({
  date,
  today,
  onDate,
  score,
  ratios,
  habits,
  compare,
  strip,
  notes,
  goalText,
}: Props) {
  const isToday = date === today;
  const prev = clampDayIso(addCalendarDays(date, -1), today);
  const atStart = prev === date;
  const next = date < today ? addCalendarDays(date, 1) : null;
  const scored = ratios.filter((r) => r.scored).length;

  function pick(nextDate: string) {
    onDate(clampDayIso(nextDate, today));
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="ui-kicker">This day</p>
          <h2 className="font-display mt-1 text-2xl text-white">
            {prettyDayLong(date, today)}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-mist)]">
            Wake, habits, tasks, study, and sleep as ratios. Tap a day or pick
            a date.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="ui-btn ui-btn-ghost !min-h-9 !px-3 disabled:opacity-30"
            onClick={() => pick(prev)}
            disabled={atStart}
            aria-label="Previous day"
          >
            <IconChevronLeft size={16} />
          </button>
          <label className="sr-only" htmlFor="progress-day">
            Pick a date
          </label>
          <input
            id="progress-day"
            type="date"
            value={date}
            max={today}
            min={clampDayIso(addCalendarDays(today, -364), today)}
            onChange={(e) => {
              if (e.target.value) pick(e.target.value);
            }}
            className="h-9 rounded-full border border-white/15 bg-black/30 px-3 text-sm text-white [color-scheme:dark]"
          />
          <button
            type="button"
            className="ui-btn ui-btn-ghost !min-h-9 !px-3 disabled:opacity-30"
            onClick={() => next && pick(next)}
            disabled={!next}
            aria-label="Next day"
          >
            <IconChevronRight size={16} />
          </button>
          {!isToday ? (
            <button
              type="button"
              className="ui-chip"
              onClick={() => pick(today)}
            >
              Today
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {strip.map((cell) => {
          const on = cell.date === date;
          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => pick(cell.date)}
              className={`min-w-0 rounded-xl border px-1 py-2 text-center ${
                on
                  ? "border-[var(--color-dawn)]/50 bg-[var(--color-dawn)]/12"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <span
                className={`block text-[10px] uppercase tracking-wide ${
                  on ? "text-white" : "text-[var(--color-mist)]"
                }`}
              >
                {cell.weekday || weekdayShort(cell.date)}
              </span>
              <span className="mt-0.5 block font-display text-sm tabular-nums text-white">
                {cell.date.slice(8)}
              </span>
              <span
                className={`mt-0.5 block text-[10px] tabular-nums ${
                  cell.score == null
                    ? "text-[var(--color-mist)]"
                    : cell.score >= 70
                      ? "text-[var(--color-leaf)]"
                      : "text-[var(--color-ember)]"
                }`}
              >
                {cell.score == null ? "—" : `${cell.score}%`}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-5">
          <RatioRing
            fill={score ?? 0}
            value={score == null ? "—" : `${score}%`}
            caption="Day"
            tone={
              score == null ? "empty" : score >= 70 ? "good" : "slip"
            }
            size={96}
            stroke={7}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-mist)]">
              Day score
            </p>
            <p className="font-display mt-1 text-[1.65rem] leading-none text-white">
              {score == null ? "Nothing scored" : `${score}%`}
            </p>
            <p className="mt-2 text-sm text-[var(--color-cloud)]">
              {score == null
                ? "Log a wake, close a habit, or sit down to study — then this day gets a score."
                : `${scored} of ${ratios.length} ratios have data. 100% study is 2 hours.`}
            </p>
            {goalText ? (
              <p className="mt-2 text-sm text-[var(--color-mist)]">{goalText}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-5">
          <RatioRow ratios={ratios} />
        </div>
      </div>

      {compare.some((row) => row.Day > 0 || row.Average > 0) ? (
        <div>
          <h3 className="font-display text-xl text-white">
            This day vs the week before
          </h3>
          <p className="mt-1 text-sm text-[var(--color-mist)]">
            Gold is {isToday ? "today" : "this day"}. Green is the average of
            the 7 days before it.
          </p>
          <div className="mt-4">
            <DayVsAverageChart data={compare} />
          </div>
        </div>
      ) : null}

      {habits.length ? (
        <div>
          <h3 className="font-display text-xl text-white">Habits this day</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {habits.map((h) => (
              <li
                key={h.key}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] ${
                  h.done
                    ? "bg-[var(--color-dawn)]/15 text-[var(--color-dawn)]"
                    : "border border-white/12 text-[var(--color-mist)]"
                }`}
              >
                {h.done ? <IconCheck size={12} strokeWidth={2.4} /> : null}
                {h.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {notes ? (
        <div>
          <h3 className="font-display text-xl text-white">Notes</h3>
          <p className="mt-1 text-sm text-[var(--color-cloud)]">{notes}</p>
        </div>
      ) : null}

      <p className="text-sm text-[var(--color-mist)]">
        <Link href={`/tasks/day/${date}`} className="ui-btn-text">
          Open the full day report
        </Link>
        {" · "}
        tasks, lists, and checkboxes for {prettyDayLong(date, today).toLowerCase()}.
      </p>
    </section>
  );
}
