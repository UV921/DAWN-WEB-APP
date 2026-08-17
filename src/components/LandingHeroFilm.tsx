"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { DailyLoop } from "@/components/DailyLoop";
import { MorningPulseCard } from "@/components/MorningPulseCard";
import { IconShare } from "@/components/icons";
import { GraduationCapIcon } from "@/components/ui/graduation-cap";
import { cn } from "@/lib/utils";

const PULSE = {
  tone: "good" as const,
  headline: "You woke. Two tasks open.",
  body: "Wake is in. Habits are on the clock. Lists wait on Tasks.",
  nextMove: "No phone · until 08:00",
};

const HABITS = [
  { label: "Wake early", meta: "Done", done: true },
  { label: "No phone", meta: "Tap · until 08:00", done: false },
  { label: "Gym", meta: "Opens in 1h 12m", done: false, locked: true },
  { label: "Reading", meta: "Opens later today", done: false, locked: true },
  { label: "Sleep early", meta: "From 22:00", done: false, locked: true },
];

const LISTS = [
  {
    name: "Today",
    items: [
      { text: "Send the brief", done: true },
      { text: "Gym bag in the hall", done: true },
      { text: "Call back before 11", done: false },
    ],
  },
];

function clock(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

export function LandingHeroFilm() {
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { margin: "-40px" });
  const still = Boolean(reduce) || !inView;
  const [secs, setSecs] = useState(reduce ? 6138 : 6132);

  useEffect(() => {
    if (still) return;
    const id = window.setInterval(() => setSecs((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [still]);

  return (
    <div
      ref={root}
      className={cn(
        "h-full overflow-y-auto bg-[#0a0e12] px-4 py-5 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        still && "study-film-still"
      )}
      aria-hidden
    >
      <div className="pointer-events-none mx-auto max-w-xl space-y-5">
        <header>
          <p className="text-sm text-[var(--color-mist)]">Sat, Aug 15 · up 05:52</p>
          <h1 className="font-display mt-1 text-3xl text-white">Morning</h1>
        </header>

        <MorningPulseCard pulse={PULSE} />

        <section className="steel-plate rounded-2xl bg-[var(--color-leaf)]/[0.08] px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center steel-plate rounded-2xl bg-[var(--color-leaf)]/10 text-[var(--color-leaf)]">
              <GraduationCapIcon size={30} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-[var(--color-leaf)]">
                Study · today · live
              </p>
              <p className="font-display mt-1 text-[clamp(1.35rem,6vw,1.875rem)] leading-none tabular-nums text-white">
                {clock(secs)}
              </p>
              <p className="mt-1.5 truncate text-sm text-[var(--color-mist)]">
                Counting now — leave the VC when you stop.
              </p>
            </div>
            <span className="shrink-0 text-xs text-[var(--color-dawn)]">Stats</span>
          </div>
        </section>

        <section className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="ui-card ui-card-compact !text-left">
              <p className="ui-card-label">Streak</p>
              <p className="font-display mt-1 text-3xl text-[var(--color-leaf)]">7</p>
              <p className="mt-1 text-xs text-[var(--color-mist)]">early wakes</p>
            </div>
            <div className="ui-card ui-card-compact !text-left">
              <p className="ui-card-label">Morning</p>
              <p className="font-display mt-1 text-3xl text-white">1/5</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[20%] rounded-full bg-[var(--color-dawn)]" />
              </div>
            </div>
            <div className="ui-card ui-card-compact !text-left">
              <p className="ui-card-label">Run</p>
              <p className="font-display mt-1 text-3xl text-white">3/7</p>
              <p className="mt-1 text-xs text-[var(--color-mist)]">4 left</p>
            </div>
            <div className="ui-card ui-card-compact !text-left">
              <p className="ui-card-label">Reward</p>
              <p className="font-display mt-1 text-3xl text-[var(--color-dawn)]">
                Lv 4
              </p>
              <p className="mt-1 text-xs text-[var(--color-mist)]">240 XP · 40 to next</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[50%] rounded-full bg-[var(--color-dawn)]" />
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-dawn)]/35 bg-[var(--color-dawn)]/10 px-3 py-1.5 text-xs font-medium text-[var(--color-dawn)]">
            <IconShare size={13} />
            Share today
          </span>
        </section>

        <DailyLoop
          steps={[
            { key: "wake", label: "Wake", detail: "05:52", done: true },
            { key: "habits", label: "Habits", detail: "1/5", done: false },
            { key: "tasks", label: "Tasks", detail: "2/3", done: false },
            { key: "night", label: "Night", detail: "23:00", done: false },
          ]}
        />

        <p className="text-sm text-[var(--color-mist)]">
          Next: No phone · 2h 8m left
        </p>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[15px] font-medium text-white">Morning habits</h2>
            <span className="text-xs text-[var(--color-mist)]">Edit</span>
          </div>
          <ul className="space-y-2">
            {HABITS.map((h) => (
              <li
                key={h.label}
                className={`ui-row ${h.done ? "is-done" : ""} ${h.locked ? "is-locked" : ""}`}
              >
                <span className={`ui-check ${h.done ? "is-on" : ""}`}>✓</span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block font-medium text-white">{h.label}</span>
                  <span className="mt-0.5 block text-xs text-[var(--color-mist)]">
                    {h.meta}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[15px] font-medium text-white">Check off</h2>
            <span className="text-xs text-[var(--color-mist)]">Add in Tasks</span>
          </div>
          <div className="space-y-3">
            {LISTS.map((list) => {
              const done = list.items.filter((t) => t.done).length;
              return (
                <article
                  key={list.name}
                  className="overflow-hidden border border-white/10 bg-black/25"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-display text-xl text-[var(--color-dawn)]">
                        {list.name}
                      </p>
                      <p className="text-[11px] tabular-nums text-[var(--color-mist)]">
                        {done} of {list.items.length}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-dawn)]/40 bg-[var(--color-dawn)]/12 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-[var(--color-dawn)]">
                      <IconShare size={13} />
                      Share PNG
                    </span>
                  </div>
                  <ul>
                    {list.items.map((t) => (
                      <li
                        key={t.text}
                        className="flex items-center border-b border-white/[0.06] last:border-0"
                      >
                        <span
                          className={`flex min-h-12 min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left ${
                            t.done ? "opacity-50" : ""
                          }`}
                        >
                          <span className={`ui-check ${t.done ? "is-on" : ""}`}>✓</span>
                          <span
                            className={`min-w-0 flex-1 text-sm leading-snug ${
                              t.done
                                ? "text-[var(--color-mist)] line-through"
                                : "text-white"
                            }`}
                          >
                            {t.text}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        <p className="text-xs text-[var(--color-mist)]">
          Loop rewards: wake + habits in-window, +18 XP for clearing Tasks, +22
          XP closing night, +40 XP if you finish the whole day.
        </p>
      </div>
    </div>
  );
}
