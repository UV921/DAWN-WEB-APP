"use client";

import { useEffect, useMemo, useState } from "react";
import { DayTallyCard } from "@/components/DayTallyCard";
import type { DayTally, TallyHit } from "@/lib/day-tally";

type Props = {
  open: boolean;
  tally: DayTally;
  hit?: TallyHit | null;
  celebrate?: "big" | "chill";
  onClose: () => void;
};

/** Overlay that fires when you tap going-to-sleep — the day’s tally, then rest. */
export function NightTally({
  open,
  tally,
  hit,
  celebrate = "big",
  onClose,
}: Props) {
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (!open) return;
    setBurst((b) => b + 1);
    if (celebrate === "big") playChime();
    const t = window.setTimeout(onClose, celebrate === "big" ? 5200 : 2800);
    return () => window.clearTimeout(t);
  }, [open, celebrate, onClose]);

  const particles = useMemo(
    () =>
      Array.from({ length: celebrate === "big" ? 22 : 8 }, (_, i) => ({
        id: `${burst}-${i}`,
        left: `${8 + ((i * 37) % 84)}%`,
        delay: `${(i % 8) * 0.05}s`,
        hue: i % 3 === 0 ? "dawn" : i % 3 === 1 ? "ember" : "leaf",
      })),
    [burst, celebrate]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label="Today’s tally"
    >
      {celebrate === "big" &&
        particles.map((p) => (
          <span
            key={p.id}
            className={`pointer-events-none absolute top-[38%] h-2 w-2 rounded-full wake-particle wake-particle-${p.hue}`}
            style={{ left: p.left, animationDelay: p.delay }}
          />
        ))}
      <div
        className="animate-rise relative w-full max-w-md rounded-3xl border border-[var(--color-dawn)]/40 bg-[#0d131a] p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="ui-kicker">Night closed</p>
        <h2 className="ui-title mt-2 text-[1.75rem]">
          {hit?.title || "Today’s tally"}
        </h2>
        {hit?.subtitle ? (
          <p className="mt-2 text-sm text-[var(--color-mist)]">{hit.subtitle}</p>
        ) : (
          <p className="mt-2 text-sm text-[var(--color-mist)]">
            Phone down. This is the day you closed.
          </p>
        )}

        {hit && hit.xpGained > 0 ? (
          <p className="font-display mt-4 text-4xl text-[var(--color-dawn)]">
            +{hit.xpGained} XP
          </p>
        ) : null}

        {hit?.labels?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {hit.labels.map((l) => (
              <span
                key={l}
                className="rounded-full bg-[var(--color-dawn)]/15 px-2.5 py-1 text-xs text-[var(--color-dawn)]"
              >
                {l}
              </span>
            ))}
          </div>
        ) : null}

        <DayTallyCard tally={tally} className="mt-5" />

        {hit && hit.progress >= 0 ? (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-[var(--color-mist)]">
              <span>Level {hit.level}</span>
              <span>{Math.round(hit.progress * 100)}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[var(--color-dawn)] transition-all duration-700"
                style={{ width: `${Math.min(100, hit.progress * 100)}%` }}
              />
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="ui-btn ui-btn-primary mt-5 w-full"
        >
          Sleep well
        </button>
      </div>
    </div>
  );
}

function playChime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const notes = [392, 523.25, 659.25];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.1, now + 0.02 + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5 + i * 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + 0.6 + i * 0.12);
    });
    window.setTimeout(() => void ctx.close(), 1400);
  } catch {
    /* ignore */
  }
}
