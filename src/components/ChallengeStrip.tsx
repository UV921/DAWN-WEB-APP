"use client";

import { useState } from "react";

const PRESETS = [3, 7, 14, 21, 30] as const;

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
  const [custom, setCustom] = useState("");

  function pickDays() {
    const fromCustom = custom.trim() ? Number(custom) : NaN;
    if (Number.isFinite(fromCustom)) {
      return Math.min(90, Math.max(3, Math.round(fromCustom)));
    }
    return days;
  }

  if (!active || ended) {
    return (
      <section className="rounded-2xl border border-dashed border-white/20 px-5 py-5">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-dawn)]">
          {ended ? "Challenge complete · start another" : "Wake challenge"}
        </p>
        <p className="font-display mt-2 text-2xl text-white">
          How many days do you want?
        </p>
        <p className="mt-2 text-sm text-[var(--color-mist)]">
          Pick any length (3–90). Opening Dawn every day is half the habit
          {focusLabel ? ` · focus: ${focusLabel}` : ""}.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setDays(n);
                setCustom("");
              }}
              className={`rounded-full border px-3.5 py-1.5 text-sm ${
                days === n && !custom
                  ? "border-[var(--color-dawn)] bg-[var(--color-dawn)]/15 text-[var(--color-dawn)]"
                  : "border-white/15 text-white"
              }`}
            >
              {n} days
            </button>
          ))}
        </div>

        <label className="mt-3 block text-sm text-[var(--color-mist)]">
          Or custom (3–90)
          <input
            type="number"
            min={3}
            max={90}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="e.g. 10"
            className="mt-2 w-full max-w-[10rem] rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-[var(--color-dawn)]"
          />
        </label>

        {onStart ? (
          <button
            type="button"
            onClick={() => onStart(pickDays())}
            className="mt-4 rounded-full bg-[var(--color-dawn)] px-5 py-2.5 text-sm font-semibold text-[var(--color-night)]"
          >
            Start {pickDays()}-day challenge
          </button>
        ) : null}
      </section>
    );
  }

  const pct = Math.min(100, Math.round((day / Math.max(1, total)) * 100));

  return (
    <section className="rounded-2xl border border-[var(--color-dawn)]/25 bg-[var(--color-dawn)]/[0.06] px-5 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-dawn)]">
            {ended ? "Challenge complete" : `${total}-day challenge`}
          </p>
          <p className="font-display mt-1 text-2xl text-white">
            {ended ? "You finished the run" : `Day ${day} of ${total}`}
          </p>
          <p className="mt-1 text-sm text-[var(--color-mist)]">
            {ended
              ? "Start another length when you’re ready."
              : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left · protect the streak`}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-[var(--color-leaf)]">Open streak · {openStreak}d</p>
          <p className="text-[var(--color-mist)]">Early streak · {earlyStreak}d</p>
        </div>
      </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/30">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--color-ember)] to-[var(--color-dawn)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </section>
  );
}
