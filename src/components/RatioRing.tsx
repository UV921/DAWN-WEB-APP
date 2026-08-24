"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { DayRatio, DayRatioTone } from "@/lib/day-progress";

const EASE = [0.22, 1, 0.36, 1] as const;

const TONE_STROKE: Record<DayRatioTone, string> = {
  good: "var(--color-leaf)",
  slip: "var(--color-ember)",
  empty: "rgba(255,255,255,0.22)",
};

export function RatioRing({
  fill,
  value,
  caption,
  tone = "empty",
  size = 72,
  stroke = 5.5,
}: {
  fill: number;
  value: string;
  caption: string;
  tone?: DayRatioTone;
  size?: number;
  stroke?: number;
}) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, fill));
  const offset = c * (1 - pct / 100);
  const gid = `ratio-ring-${uid}`;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-label={`${caption} ${pct} percent`}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        width={size}
        height={size}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-ember)" />
            <stop offset="100%" stopColor="var(--color-dawn)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone === "good" ? `url(#${gid})` : TONE_STROKE[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.85, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-1 text-center leading-none">
        <span
          className={`font-display tabular-nums text-white ${
            size >= 90 ? "text-[1.05rem]" : "text-[0.7rem]"
          }`}
        >
          {value}
        </span>
        <span className="mt-0.5 text-[8px] uppercase tracking-[0.12em] text-[var(--color-mist)]">
          {caption}
        </span>
      </div>
    </div>
  );
}

export function RatioRow({ ratios }: { ratios: DayRatio[] }) {
  return (
    <ul className="grid grid-cols-5 gap-1.5">
      {ratios.map((r) => (
        <li key={r.key} className="min-w-0 text-center">
          <div className="flex justify-center">
            <RatioRing
              fill={r.scored ? r.pct : 0}
              value={r.scored ? `${r.pct}%` : "—"}
              caption={r.label}
              tone={r.tone}
              size={58}
              stroke={5}
            />
          </div>
          <p className="mt-1 truncate font-display text-[13px] tabular-nums text-white">
            {r.value}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[var(--color-mist)]">
            {r.hint}
          </p>
        </li>
      ))}
    </ul>
  );
}
