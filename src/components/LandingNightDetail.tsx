"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { SleepTimingChart } from "@/components/SleepTimingChart";

const EASE = [0.22, 1, 0.36, 1] as const;
const MIN = 7;
const PLAN = 7;
const TARGET = 8;
const TAKE = 6.2;
const WEEK = 6.8;
const MAX = 9;

const DEMO_NIGHTS = [
  {
    date: "2026-08-10",
    weekday: "Mon",
    bedtime: "22:50",
    wakeTime: "06:00",
    hours: 7.2,
    metMin: true,
  },
  {
    date: "2026-08-11",
    weekday: "Tue",
    bedtime: "00:10",
    wakeTime: "06:10",
    hours: 6.0,
    metMin: false,
  },
  {
    date: "2026-08-12",
    weekday: "Wed",
    bedtime: "22:40",
    wakeTime: "06:05",
    hours: 7.4,
    metMin: true,
  },
  {
    date: "2026-08-13",
    weekday: "Thu",
    bedtime: "00:40",
    wakeTime: "06:30",
    hours: 5.8,
    metMin: false,
  },
  {
    date: "2026-08-14",
    weekday: "Fri",
    bedtime: "23:20",
    wakeTime: "06:15",
    hours: 6.9,
    metMin: false,
  },
  {
    date: "2026-08-15",
    weekday: "Sat",
    bedtime: "22:30",
    wakeTime: "06:30",
    hours: 8.0,
    metMin: true,
  },
  {
    date: "2026-08-16",
    weekday: "Sun",
    bedtime: "00:20",
    wakeTime: "06:30",
    hours: 6.2,
    metMin: false,
  },
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
        "flex h-full min-h-[20rem] flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)]",
        className
      )}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      <div className="border-b border-[var(--landing-border)] bg-[linear-gradient(160deg,rgba(240,180,90,0.1),transparent_72%)] px-5 py-4">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--landing-accent)]">
          Need vs take
        </p>
        <p className="mt-1 text-[13px] text-[var(--landing-muted)]">
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
        <div className="relative h-2.5 overflow-hidden rounded-full bg-[var(--landing-track)]">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[#e07a5f]"
            style={{ width: `${takePct}%` }}
          />
          <span
            className="absolute top-0 h-full w-px bg-[var(--landing-track)]"
            style={{ left: `${pct(MIN)}%` }}
            aria-hidden
          />
          <span
            className="absolute top-0 h-full w-px bg-[#f0b45a]"
            style={{ left: `${pct(TARGET)}%` }}
            aria-hidden
          />
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-wide text-[var(--landing-muted)]">
          <li className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#e07a5f]" />
            Took {TAKE}h
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="h-2 w-px bg-[var(--landing-track)]" />
            Min {MIN}h
          </li>
          <li className="inline-flex items-center gap-1.5 text-[var(--landing-accent)]">
            <span className="h-2 w-px bg-[#f0b45a]" />
            Target {TARGET}h
          </li>
        </ul>
      </div>

      <div className="mx-4 mt-3 rounded-xl border border-[#f0b45a]/25 bg-[#f0b45a]/[0.06] px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--landing-accent)]">
          Suggestion
        </p>
        <p className="mt-1 text-[13px] leading-snug text-[var(--landing-text)]">
          Under the {MIN}h minimum. In bed by 22:30 — keep wake {wakeGoal}. Don’t
          sleep in.
        </p>
      </div>

      <div className="px-4 pb-4 pt-4">
        <SleepTimingChart
          className="landing-sleep-preview"
          compact
          nights={DEMO_NIGHTS}
          sleepGoal={sleepGoal}
          wakeGoal={wakeGoal}
        />
      </div>

      <div className="mt-auto grid grid-cols-3 gap-px border-t border-[var(--landing-border)] bg-[var(--landing-track)] text-center">
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
    <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-track)] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--landing-muted)]">
        {label}
      </p>
      <p
        className={`font-display mt-0.5 text-xl ${
          ember ? "text-[#e07a5f]" : "text-[var(--landing-text)]"
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] text-[var(--landing-muted)]">{hint}</p>
    </div>
  );
}

function StatFoot({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--landing-surface)] px-2 py-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--landing-muted)]">
        {label}
      </p>
      <p className="font-display mt-0.5 text-lg text-[var(--landing-text)]">{value}</p>
    </div>
  );
}
