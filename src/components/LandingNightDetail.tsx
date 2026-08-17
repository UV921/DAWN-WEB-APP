"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;
const MIN = 7;
const PLAN = 7;
const TARGET = 8;
const TAKE = 6.2;
const WEEK = 6.8;
const MAX = 9;

const NIGHTS = [
  { d: "M", h: 7.1 },
  { d: "T", h: 6.0 },
  { d: "W", h: 7.4 },
  { d: "T", h: 5.8 },
  { d: "F", h: 6.9 },
  { d: "S", h: 8.0 },
  { d: "S", h: 6.2 },
];

function pct(n: number) {
  return Math.max(0, Math.min(100, Math.round((n / MAX) * 100)));
}

type Props = {
  sleepGoal: string;
  wakeGoal: string;
  className?: string;
};

export function LandingNightDetail({ sleepGoal, wakeGoal, className }: Props) {
  const reduce = useReducedMotion();
  const takePct = pct(TAKE);

  return (
    <motion.div
      className={cn(
        "flex h-full min-h-[20rem] flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0d131a]",
        className
      )}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      <div className="border-b border-white/[0.08] bg-[linear-gradient(160deg,rgba(240,180,90,0.1),transparent_72%)] px-5 py-4">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[#f0b45a]">
          Need vs take
        </p>
        <p className="mt-1 text-[13px] text-[#c5ced6]">
          Minimum {MIN}h. Plan {PLAN}h ({sleepGoal} → {wakeGoal}). Last night{" "}
          {TAKE}h — under the floor.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
        <Mini label="Minimum" value={`${MIN}h`} hint="adult floor" />
        <Mini label="Your plan" value={`${PLAN}h`} hint={`${sleepGoal} → ${wakeGoal}`} />
        <Mini label="Last night" value={`${TAKE}h`} hint="took" ember />
        <Mini label="Week avg" value={`${WEEK}h`} hint="4.2h debt" />
      </div>

      <div className="px-5">
        <div className="relative h-2.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[#e07a5f]"
            style={{ width: `${takePct}%` }}
          />
          <span
            className="absolute top-0 h-full w-px bg-white/80"
            style={{ left: `${pct(MIN)}%` }}
          />
          <span
            className="absolute top-0 h-full w-px bg-[#f0b45a]"
            style={{ left: `${pct(TARGET)}%` }}
          />
        </div>
        <div className="relative mt-1 h-4 text-[10px] uppercase tracking-wide text-[#8ba3b8]">
          <span
            className="absolute -translate-x-1/2"
            style={{ left: `${pct(MIN)}%` }}
          >
            min {MIN}h
          </span>
          <span
            className="absolute -translate-x-1/2 text-[#f0b45a]"
            style={{ left: `${pct(TARGET)}%` }}
          >
            {TARGET}h
          </span>
        </div>
      </div>

      <div className="mx-4 mt-2 rounded-xl border border-[#f0b45a]/25 bg-[#f0b45a]/[0.06] px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[#f0b45a]">
          Suggestion
        </p>
        <p className="mt-1 text-[13px] leading-snug text-white">
          Under the {MIN}h minimum. In bed by 22:30 — keep wake {wakeGoal}. Don’t
          sleep in.
        </p>
      </div>

      <div className="px-5 pb-4 pt-4">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[#8ba3b8]">
          Report · last 7 nights
        </p>
        <ul className="mt-2 grid grid-cols-7 gap-1.5">
          {NIGHTS.map((n, i) => (
            <li key={`${n.d}-${i}`} className="text-center">
              <div className="flex h-12 items-end justify-center rounded-md bg-white/[0.04] px-1 py-1">
                <div
                  className={`w-full rounded-sm ${
                    n.h >= MIN ? "bg-[#f0b45a]" : "bg-[#e07a5f]"
                  }`}
                  style={{ height: `${Math.max(18, pct(n.h))}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-[#8ba3b8]">{n.d}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto grid grid-cols-3 gap-px border-t border-white/[0.08] bg-white/[0.04] text-center">
        <StatFoot label="Bed on time" value="43%" />
        <StatFoot label="Wake on time" value="71%" />
        <StatFoot label="Score" value="62" />
      </div>
    </motion.div>
  );
}

function Mini({
  label,
  value,
  hint,
  ember,
}: {
  label: string;
  value: string;
  hint: string;
  ember?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[#8ba3b8]">
        {label}
      </p>
      <p
        className={`font-display mt-0.5 text-xl ${
          ember ? "text-[#e07a5f]" : "text-white"
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] text-[#8ba3b8]">{hint}</p>
    </div>
  );
}

function StatFoot({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0d131a] px-2 py-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[#8ba3b8]">
        {label}
      </p>
      <p className="font-display mt-0.5 text-lg text-white">{value}</p>
    </div>
  );
}
