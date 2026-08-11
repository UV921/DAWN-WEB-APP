"use client";

import { useState } from "react";

type Props = {
  earlyStreak: number;
  openStreak: number;
  habitsDone: number;
  habitsTotal: number;
  challenge: {
    active: boolean;
    day: number;
    total: number;
    daysLeft: number;
    ended: boolean;
  } | null;
  onStartChallenge: (days: number) => void;
};

const LENGTHS = [7, 14, 21, 30] as const;

/**
 * Today overview — three clear boxes: streak, habits, challenge.
 * Challenge can be started from here.
 */
export function TodayOverview({
  earlyStreak,
  openStreak,
  habitsDone,
  habitsTotal,
  challenge,
  onStartChallenge,
}: Props) {
  const [days, setDays] = useState(7);
  const active = Boolean(challenge?.active);
  const ended = Boolean(challenge?.ended);
  const pct = active
    ? Math.min(
        100,
        Math.round(
          ((challenge?.day || 0) / Math.max(1, challenge?.total || 1)) * 100
        )
      )
    : 0;

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatBox
          label="Early streak"
          value={String(earlyStreak)}
          unit="days"
          accent="leaf"
        />
        <StatBox
          label="Habits today"
          value={`${habitsDone}/${habitsTotal || 1}`}
          unit="done"
          accent="dawn"
        />
        <StatBox
          label="Opened Dawn"
          value={String(openStreak)}
          unit="days"
          accent="cloud"
        />
      </div>

      <div className="ui-card">
        {active && !ended ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="ui-card-label">Challenge</p>
                <p className="font-display mt-1 text-2xl text-white">
                  Day {challenge?.day}
                  <span className="text-[var(--color-mist)]">
                    /{challenge?.total}
                  </span>
                </p>
                <p className="mt-1 text-sm text-[var(--color-mist)]">
                  {challenge?.daysLeft} day
                  {challenge?.daysLeft === 1 ? "" : "s"} left
                </p>
              </div>
              <p className="ui-stat text-3xl leading-none">{pct}%</p>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[var(--color-dawn)] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="ui-card-label">
                  {ended ? "Challenge done" : "Start a challenge"}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--color-cloud)]">
                  {ended
                    ? "Nice run. Pick a new length and go again."
                    : "Commit to waking early for a set number of days."}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {LENGTHS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDays(n)}
                  className={`rounded-full px-3.5 py-1.5 text-sm transition ${
                    days === n
                      ? "bg-[var(--color-dawn)] font-semibold text-[var(--color-night)]"
                      : "border border-white/15 text-[var(--color-mist)] hover:border-white/30 hover:text-white"
                  }`}
                >
                  {n}d
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onStartChallenge(days)}
              className="ui-btn ui-btn-primary mt-4 w-full sm:w-auto"
            >
              Start {days}-day challenge
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function StatBox({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  accent: "leaf" | "dawn" | "cloud";
}) {
  const color =
    accent === "leaf"
      ? "text-[var(--color-leaf)]"
      : accent === "dawn"
        ? "text-[var(--color-dawn)]"
        : "text-white";

  return (
    <div className="ui-card ui-card-compact">
      <p className="ui-card-label">{label}</p>
      <p className={`font-display mt-1.5 text-2xl tabular-nums sm:text-3xl ${color}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--color-mist)] sm:text-xs">
        {unit}
      </p>
    </div>
  );
}
