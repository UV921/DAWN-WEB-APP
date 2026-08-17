"use client";

import type { MorningPulse } from "@/lib/morning-pulse";

const TONE: Record<
  MorningPulse["tone"],
  { kicker: string; border: string; bg: string }
> = {
  start: {
    kicker: "The loop",
    border: "border-white/15",
    bg: "bg-white/[0.04]",
  },
  good: {
    kicker: "On track",
    border: "border-[var(--color-leaf)]/35",
    bg: "bg-[var(--color-leaf)]/[0.08]",
  },
  slip: {
    kicker: "Slipping",
    border: "border-[var(--color-dawn)]/40",
    bg: "bg-[var(--color-dawn)]/[0.08]",
  },
  danger: {
    kicker: "Not good",
    border: "border-[var(--color-ember)]/45",
    bg: "bg-[var(--color-ember)]/[0.1]",
  },
};

export function MorningPulseCard({ pulse }: { pulse: MorningPulse }) {
  const t = TONE[pulse.tone] ?? TONE.start;
  return (
    <section className={`relative overflow-hidden rounded-[1.1rem] border px-5 py-5 ${t.border} ${t.bg}`}>
      <p className="ui-kicker">{t.kicker}</p>
      <h2 className="font-display mt-2 text-[1.85rem] leading-[1.15] text-white">
        {pulse.headline}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-cloud)]">
        {pulse.body}
      </p>
      <div className="mt-4 border-l-2 border-[var(--color-dawn)] bg-black/20 px-3 py-2.5">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-dawn)]">
          Next
        </p>
        <p className="mt-1 text-sm font-medium text-white">{pulse.nextMove}</p>
      </div>
    </section>
  );
}
