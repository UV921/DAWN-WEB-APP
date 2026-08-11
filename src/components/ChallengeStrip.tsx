"use client";

import { useState } from "react";

const PRESETS = [7, 14, 21, 30] as const;

type Props = {
  day: number;
  total: number;
  daysLeft: number;
  active: boolean;
  ended: boolean;
  openStreak: number;
  earlyStreak: number;
  focusLabel?: string;
  onStart?: (days: number) => void;
};

/** Classic challenge card — one length control, one primary action. */
export function ChallengeStrip({
  day,
  total,
  daysLeft,
  active,
  ended,
  openStreak,
  earlyStreak,
  focusLabel,
  onStart,
}: Props) {
  const [days, setDays] = useState(7);

  if (!active || ended) {
    return (
      <section className="ui-section">
        <p className="ui-kicker">
          {ended ? "Challenge finished" : "Challenge"}
        </p>
        <h2 className="ui-title mt-2">
          {ended ? "Start another run" : "Commit to a stretch"}
        </h2>
        <p className="ui-sub mt-2">
          Pick a length. Wake early each morning
          {focusLabel ? ` — focus on ${focusLabel}` : ""}. Dawn will show which
          day you’re on.
        </p>

        <div className="mt-6 flex items-end gap-4">
          <label className="block flex-1">
            <span className="text-xs text-[var(--color-mist)]">Length</span>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="ui-field mt-2"
            >
              {PRESETS.map((n) => (
                <option key={n} value={n} className="bg-[var(--color-night)]">
                  {n} days
                </option>
              ))}
              <option value={3} className="bg-[var(--color-night)]">
                3 days
              </option>
              <option value={10} className="bg-[var(--color-night)]">
                10 days
              </option>
              <option value={45} className="bg-[var(--color-night)]">
                45 days
              </option>
              <option value={60} className="bg-[var(--color-night)]">
                60 days
              </option>
              <option value={90} className="bg-[var(--color-night)]">
                90 days
              </option>
            </select>
          </label>
          <p className="ui-stat pb-2 text-4xl leading-none">{days}</p>
        </div>

        {onStart ? (
          <button
            type="button"
            onClick={() => onStart(days)}
            className="ui-btn ui-btn-primary mt-6"
          >
            Begin {days}-day challenge
          </button>
        ) : null}
      </section>
    );
  }

  const pct = Math.min(100, Math.round((day / Math.max(1, total)) * 100));

  return (
    <section className="ui-section">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="ui-kicker">{total}-day challenge</p>
          <p className="font-display mt-2 text-3xl text-white">
            Day {day}
            <span className="text-[var(--color-mist)]"> / {total}</span>
          </p>
          <p className="mt-1 text-sm text-[var(--color-mist)]">
            {daysLeft} left
          </p>
        </div>
        <div className="text-right text-sm text-[var(--color-mist)]">
          <p>
            <span className="text-[var(--color-leaf)]">{earlyStreak}</span> early
            days
          </p>
          <p className="mt-0.5">
            <span className="text-white">{openStreak}</span> days opened Dawn
          </p>
        </div>
      </div>
      <div className="mt-5 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[var(--color-dawn)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </section>
  );
}
