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

export function MorningPulseCard({
  pulse,
  usedAi,
}: {
  pulse: MorningPulse;
  usedAi?: boolean;
}) {
  const t = TONE[pulse.tone];
  return (
    <section className={`rounded-2xl border px-4 py-4 ${t.border} ${t.bg}`}>
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-[var(--color-dawn)]">
        {t.kicker}
        {usedAi ? " · AI" : ""}
      </p>
      <h2 className="font-display mt-2 text-2xl leading-snug text-white">
        {pulse.headline}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-cloud)]">
        {pulse.body}
      </p>
      <p className="mt-3 text-sm text-white">{pulse.nextMove}</p>
    </section>
  );
}
