"use client";

import Link from "next/link";
import { formatStudyDuration } from "@/lib/study-time";
import type { StudyStatus, StudyStatusTone } from "@/lib/study-status";

export type StudyStats = {
  configured: boolean;
  hasDiscord: boolean;
  today: {
    date: string;
    minutes: number;
    label: string;
    live: boolean;
  };
  week: { date: string; minutes: number }[];
  weekMinutes: number;
  weekLabel: string;
  weekDaysWithStudy?: number;
  month?: { date: string; minutes: number }[];
  monthMinutes?: number;
  monthLabel?: string;
  monthDaysWithStudy?: number;
  streak?: number;
  bestDay?: { date: string; minutes: number; label: string } | null;
  status: StudyStatus;
};

const TONE: Record<
  StudyStatusTone,
  { border: string; bg: string; kicker: string }
> = {
  live: {
    border: "border-[var(--color-leaf)]/40",
    bg: "bg-[var(--color-leaf)]/[0.08]",
    kicker: "text-[var(--color-leaf)]",
  },
  good: {
    border: "border-[var(--color-dawn)]/35",
    bg: "bg-[var(--color-dawn)]/[0.07]",
    kicker: "text-[var(--color-dawn)]",
  },
  thin: {
    border: "border-[var(--color-ember)]/40",
    bg: "bg-[var(--color-ember)]/[0.08]",
    kicker: "text-[var(--color-ember)]",
  },
  empty: {
    border: "border-white/12",
    bg: "bg-white/[0.03]",
    kicker: "text-[var(--color-mist)]",
  },
  setup: {
    border: "border-white/12",
    bg: "bg-white/[0.03]",
    kicker: "text-[var(--color-mist)]",
  },
};

function weekdayLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "narrow",
  });
}

function prettyDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function StudyStatusPanel({
  data,
  compact = false,
}: {
  data: StudyStats;
  compact?: boolean;
}) {
  const t = TONE[data.status.tone];
  const bars = compact ? data.week : data.month?.slice(-14) || data.week;
  const maxBar = Math.max(1, ...bars.map((d) => d.minutes));

  return (
    <section className={`rounded-2xl border px-5 py-5 ${t.border} ${t.bg}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p
          className={`text-[0.65rem] font-medium uppercase tracking-[0.18em] ${t.kicker}`}
        >
          {data.status.kicker}
        </p>
        <Link
          href="/settings?tab=discord"
          className="text-xs text-[var(--color-mist)]"
        >
          Rooms
        </Link>
      </div>

      <h2 className="font-display mt-2 text-[1.65rem] leading-[1.2] text-white">
        {data.status.headline}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-cloud)]">
        {data.status.body}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Mini
          label="Today"
          value={data.today.label}
          live={data.today.live}
        />
        <Mini label="This week" value={data.weekLabel} />
        <Mini
          label={data.streak ? "Study streak" : "Days this week"}
          value={
            data.streak
              ? `${data.streak}d`
              : `${data.weekDaysWithStudy ?? data.week.filter((d) => d.minutes > 0).length}`
          }
        />
      </div>

      {bars.length ? (
        <div className="mt-4 flex items-end gap-1">
          {bars.map((d) => {
            const h = Math.max(3, Math.round((d.minutes / maxBar) * (compact ? 32 : 44)));
            const isToday = d.date === data.today.date;
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`w-full rounded-sm ${
                    isToday
                      ? "bg-[var(--color-dawn)]"
                      : d.minutes > 0
                        ? "bg-white/30"
                        : "bg-white/10"
                  }`}
                  style={{ height: h }}
                  title={`${prettyDay(d.date)} · ${formatStudyDuration(d.minutes)}`}
                />
                {compact || bars.length <= 7 ? (
                  <span className="text-[10px] text-[var(--color-mist)]">
                    {weekdayLabel(d.date)}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {!compact && data.bestDay && data.bestDay.minutes > 0 ? (
        <p className="mt-3 text-xs text-[var(--color-mist)]">
          Best day this week: {prettyDay(data.bestDay.date)} · {data.bestDay.label}
          {data.monthLabel
            ? ` · Last ${data.month?.length || 30} days: ${data.monthLabel} across ${data.monthDaysWithStudy || 0} days`
            : ""}
        </p>
      ) : null}
    </section>
  );
}

function Mini({
  label,
  value,
  live,
}: {
  label: string;
  value: string;
  live?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-mist)]">
        {label}
      </p>
      <p className="mt-0.5 font-display text-lg text-white">
        {value}
        {live ? (
          <span className="ml-1.5 align-middle text-[10px] font-sans uppercase tracking-[0.12em] text-[var(--color-leaf)]">
            live
          </span>
        ) : null}
      </p>
    </div>
  );
}
