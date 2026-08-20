"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";

export const MISSION_RING_EASE = [0.22, 1, 0.36, 1] as const;

export function MissionPctRing({
  fill,
  value,
  caption,
  pulse,
  ariaLabel,
}: {
  fill: number;
  value: string | number;
  caption: string;
  pulse?: boolean;
  ariaLabel?: string;
}) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const size = 64;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, fill));
  const offset = c * (1 - pct / 100);
  const gid = `mission-ring-${uid}`;

  return (
    <div
      className="relative h-16 w-16 shrink-0"
      aria-label={ariaLabel || `${pct} percent ${caption}`}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="h-16 w-16 -rotate-90">
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
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{
            strokeDashoffset: offset,
            opacity: pulse ? [0.45, 1, 0.45] : 1,
          }}
          transition={
            pulse && !reduce
              ? { opacity: { duration: 2.4, repeat: Infinity, ease: "easeInOut" } }
              : { duration: 0.9, ease: MISSION_RING_EASE }
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-display text-[0.95rem] tabular-nums text-white">
          {value}
          {typeof value === "number" ? (
            <span className="text-[0.6rem]">%</span>
          ) : null}
        </span>
        <span className="mt-0.5 text-[8px] uppercase tracking-[0.12em] text-[var(--color-mist)]">
          {caption}
        </span>
      </div>
    </div>
  );
}
