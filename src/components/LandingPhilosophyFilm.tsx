"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";
import { FlameIcon } from "@/components/animated-icons/flame";
import { ListTodoIcon } from "@/components/animated-icons/list-todo";
import { MoonIcon } from "@/components/animated-icons/moon";
import { SunIcon } from "@/components/animated-icons/sun";
import type { AnimatedIconHandle } from "@/components/animated-icons/use-icon-animation";
import type { HabitWindow } from "@/lib/habit-windows";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;
const SCENE_MS = 3200;

const SKIES = [
  "from-[#120e0a] via-[#6a3814] to-[#e39a3a]",
  "from-[#1a2434] via-[#4d6278] to-[#c9ae7a]",
  "from-[#121c28] via-[#314656] to-[#7d8e9a]",
  "from-[#05070c] via-[#0a121c] to-[#151e2c]",
];

const SUN = [
  { x: "18%", y: "46%", scale: 1, opacity: 1 },
  { x: "46%", y: "22%", scale: 1.08, opacity: 1 },
  { x: "74%", y: "30%", scale: 0.92, opacity: 0.85 },
  { x: "92%", y: "78%", scale: 0.4, opacity: 0 },
];

const MOON = [
  { x: "78%", y: "70%", opacity: 0, scale: 0.6 },
  { x: "78%", y: "62%", opacity: 0, scale: 0.6 },
  { x: "78%", y: "48%", opacity: 0.15, scale: 0.8 },
  { x: "72%", y: "20%", opacity: 1, scale: 1 },
];

const NODES = ["Wake", "Habits", "Tasks", "Night"] as const;

type Props = {
  wake: string;
  sleep: string;
  wakeWin: HabitWindow;
  sleepWin: HabitWindow;
  className?: string;
};

export function LandingPhilosophyFilm({
  wake,
  sleep,
  wakeWin,
  sleepWin,
  className,
}: Props) {
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { margin: "-80px" });
  const [step, setStep] = useState(0);
  const sunIcon = useRef<AnimatedIconHandle>(null);
  const flameIcon = useRef<AnimatedIconHandle>(null);
  const listIcon = useRef<AnimatedIconHandle>(null);
  const moonIcon = useRef<AnimatedIconHandle>(null);

  useEffect(() => {
    if (reduce || !inView) return;
    const id = window.setInterval(() => {
      setStep((n) => (n + 1) % 4);
    }, SCENE_MS);
    return () => window.clearInterval(id);
  }, [reduce, inView]);

  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => {
      const icons = [sunIcon, flameIcon, listIcon, moonIcon];
      icons[step].current?.startAnimation();
    }, 480);
    return () => window.clearTimeout(t);
  }, [step, reduce]);

  const scene = step;

  return (
    <div
      ref={root}
      className={cn(
        "philosophy-film relative h-[22rem] overflow-hidden bg-[#0a0e12] sm:h-[26rem] lg:h-full lg:min-h-[26rem]",
        className
      )}
      aria-label="Dawn’s day as a loop: wake in-window, habits on a clock, tasks as inbox, night closes tomorrow"
    >
      {SKIES.map((sky, i) => (
        <motion.div
          key={sky}
          aria-hidden
          className={`absolute inset-0 bg-gradient-to-b ${sky}`}
          initial={false}
          animate={{ opacity: scene === i ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : 1.05, ease: EASE }}
        />
      ))}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-[radial-gradient(ellipse_at_50%_0%,rgba(240,180,90,0.22),transparent_62%)]"
      />

      <motion.div
        aria-hidden
        className="philosophy-mist pointer-events-none absolute inset-x-0 bottom-[28%] h-[22%]"
        animate={
          reduce
            ? undefined
            : { opacity: scene === 3 ? 0.08 : [0.18, 0.35, 0.18] }
        }
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        aria-hidden
        className="pointer-events-none absolute h-14 w-14 rounded-full bg-[#f0b45a] sm:h-[4.25rem] sm:w-[4.25rem]"
        initial={false}
        animate={{
          left: SUN[scene].x,
          top: SUN[scene].y,
          scale: SUN[scene].scale,
          opacity: SUN[scene].opacity,
        }}
        transition={{ duration: reduce ? 0 : 1.15, ease: EASE }}
        style={{
          x: "-50%",
          y: "-50%",
          boxShadow:
            "0 0 48px 18px rgba(240,180,90,0.55), 0 0 120px 40px rgba(240,180,90,0.22)",
        }}
      />

      <motion.div
        aria-hidden
        className="pointer-events-none absolute h-9 w-9 rounded-full bg-[#e8e4dc] sm:h-11 sm:w-11"
        initial={false}
        animate={{
          left: MOON[scene].x,
          top: MOON[scene].y,
          opacity: MOON[scene].opacity,
          scale: MOON[scene].scale,
        }}
        transition={{ duration: reduce ? 0 : 1.15, ease: EASE }}
        style={{
          x: "-50%",
          y: "-50%",
          boxShadow: "0 0 28px 8px rgba(232,228,220,0.18)",
          clipPath: "ellipse(46% 50% at 38% 50%)",
        }}
      />

      {STARS.map((s) => (
        <motion.span
          key={s.id}
          aria-hidden
          className="pointer-events-none absolute h-1 w-1 rounded-full bg-[#f0b45a]"
          style={{ left: s.left, top: s.top }}
          animate={{
            opacity: scene === 3 ? [0.15, 0.95, 0.15] : 0,
            scale: scene === 3 ? [0.8, 1.25, 0.8] : 0.6,
          }}
          transition={{
            duration: s.dur,
            repeat: Infinity,
            delay: s.delay,
          }}
        />
      ))}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-[#0a0e12] via-[#0a0e12]/92 to-transparent"
      />
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-[18%] h-[16%] w-full text-[#0a0e12]"
        viewBox="0 0 400 60"
        preserveAspectRatio="none"
      >
        <path
          fill="currentColor"
          d="M0 38 C 40 22 70 44 110 30 C 150 16 170 40 210 28 C 260 12 290 36 330 24 C 360 16 380 28 400 20 L 400 60 L 0 60 Z"
        />
      </svg>

      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between px-3.5 pt-3.5 sm:px-4 sm:pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#f0b45a]">
          The loop
        </p>
        <p className="font-mono text-[10px] tabular-nums text-[#e8e4dc]/55">
          {String(scene + 1).padStart(2, "0")} / 04
        </p>
      </div>

      <div className="absolute inset-x-0 top-[18%] z-10 flex justify-center px-4 sm:top-[16%]">
        <AnimatePresence mode="wait">
          <motion.div
            key={scene}
            initial={reduce ? false : { opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="w-full max-w-[19.5rem]"
          >
            {scene === 0 ? (
              <WakeCard
                wake={wake}
                start={wakeWin.start}
                end={wakeWin.end}
                iconRef={sunIcon}
              />
            ) : null}
            {scene === 1 ? <HabitsCard iconRef={flameIcon} /> : null}
            {scene === 2 ? <TasksCard iconRef={listIcon} /> : null}
            {scene === 3 ? (
              <NightCard sleep={sleep} wake={wake} iconRef={moonIcon} />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-3 sm:px-4 sm:pb-3.5">
        <div className="relative mb-2.5 h-[2px] overflow-hidden bg-white/10">
          <motion.div
            className="absolute inset-y-0 left-0 bg-[#f0b45a]"
            initial={false}
            animate={{ width: `${((scene + 1) / 4) * 100}%` }}
            transition={{ duration: reduce ? 0 : 0.7, ease: EASE }}
          />
        </div>
        <div className="grid grid-cols-4 gap-1">
          {NODES.map((label, i) => {
            const on = scene === i;
            const done = scene > i;
            return (
              <motion.div
                key={label}
                animate={{
                  backgroundColor:
                    on || done
                      ? "rgba(240,180,90,1)"
                      : "rgba(255,255,255,0.04)",
                  color: on || done ? "#0a0e12" : "#9aa6b2",
                }}
                transition={{ duration: 0.4, ease: EASE }}
                className="rounded-md px-1 py-1.5 text-center"
              >
                <p className="text-[9px] font-semibold uppercase tracking-[0.08em] sm:text-[10px]">
                  {label}
                </p>
              </motion.div>
            );
          })}
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={scene}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            className="mt-2 text-center text-[11px] leading-snug text-[#c5ced6] sm:text-[12px]"
          >
            {CAPTIONS[scene](wakeWin, sleepWin)}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

const CAPTIONS = [
  (w: HabitWindow) => `Wake only counts ${w.start}–${w.end}.`,
  () => "Habits unlock on a clock. No midnight padding.",
  () => "Add in Tasks. Today only checks them off.",
  (_w: HabitWindow, s: HabitWindow) =>
    `Set tomorrow ${s.start}–${s.end}. Then sleep well.`,
];

const STARS = [
  { id: 1, left: "12%", top: "14%", dur: 2.4, delay: 0.1 },
  { id: 2, left: "28%", top: "22%", dur: 3.1, delay: 0.5 },
  { id: 3, left: "86%", top: "16%", dur: 2.2, delay: 0.2 },
  { id: 4, left: "64%", top: "10%", dur: 2.8, delay: 0.8 },
  { id: 5, left: "8%", top: "36%", dur: 3.4, delay: 0.3 },
  { id: 6, left: "44%", top: "18%", dur: 2.6, delay: 1.1 },
];

function WakeCard({
  wake,
  start,
  end,
  iconRef,
}: {
  wake: string;
  start: string;
  end: string;
  iconRef: Ref<AnimatedIconHandle>;
}) {
  return (
    <div className="flex min-h-[11.5rem] flex-col justify-center rounded-2xl border border-white/15 bg-[#0a0e12]/72 px-4 py-3.5 backdrop-blur-md">
      <div className="flex items-center gap-2 text-[#f0b45a]">
        <SunIcon ref={iconRef} size={22} />
        <p className="text-[10px] uppercase tracking-[0.16em]">Wake</p>
      </div>
      <p className="font-display mt-2 text-[2.15rem] leading-none text-white">
        05:52
      </p>
      <p className="mt-1 text-[12px] text-[#c5ced6]">
        Goal {wake} · window {start}–{end}
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full bg-[#f0b45a]"
          initial={{ width: "0%" }}
          animate={{ width: "62%" }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
        />
      </div>
      <p className="mt-1.5 text-[10px] text-[#8ba3b8]">Inside the window</p>
    </div>
  );
}

function HabitsCard({
  iconRef,
}: {
  iconRef: Ref<AnimatedIconHandle>;
}) {
  const rows = [
    { label: "Wake early", state: "done" as const },
    { label: "No phone", state: "open" as const },
    { label: "Gym", state: "locked" as const },
    { label: "Sleep early", state: "locked" as const },
  ];
  return (
    <div className="flex min-h-[11.5rem] flex-col justify-center rounded-2xl border border-white/15 bg-[#0a0e12]/72 px-4 py-3.5 backdrop-blur-md">
      <div className="mb-2.5 flex items-center gap-2 text-[#f0b45a]">
        <FlameIcon ref={iconRef} size={20} />
        <p className="text-[10px] uppercase tracking-[0.16em]">Habits</p>
      </div>
      <ul className="space-y-1.5">
        {rows.map((r, i) => (
          <motion.li
            key={r.label}
            className="flex items-center gap-2 text-[12px]"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: r.state === "locked" ? 0.45 : 1, x: 0 }}
            transition={{ delay: 0.08 + i * 0.12, duration: 0.35, ease: EASE }}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full border text-[8px] ${
                r.state === "done"
                  ? "border-[#f0b45a] bg-[#f0b45a] text-[#0a0e12]"
                  : "border-white/25"
              }`}
            >
              {r.state === "done" ? "✓" : r.state === "locked" ? "–" : ""}
            </span>
            <span className="text-white">{r.label}</span>
            <span className="ml-auto text-[10px] text-[#8ba3b8]">
              {r.state === "done"
                ? "in window"
                : r.state === "open"
                  ? "open now"
                  : "locked"}
            </span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function TasksCard({
  iconRef,
}: {
  iconRef: Ref<AnimatedIconHandle>;
}) {
  const items = [
    { text: "Send the brief", done: true },
    { text: "Gym bag in the hall", done: true },
    { text: "Call back before 11", done: false },
  ];
  return (
    <div className="flex min-h-[11.5rem] flex-col justify-center rounded-2xl border border-white/15 bg-[#0a0e12]/72 px-4 py-3.5 backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#f0b45a]">
          <ListTodoIcon ref={iconRef} size={20} />
          <p className="text-[10px] uppercase tracking-[0.16em]">Inbox</p>
        </div>
        <p className="text-[10px] text-[#8ba3b8]">Add in Tasks</p>
      </div>
      <ul className="space-y-1.5">
        {items.map((t, i) => (
          <motion.li
            key={t.text}
            className="flex items-center gap-2 text-[12px]"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.14, duration: 0.35, ease: EASE }}
          >
            <motion.span
              className="flex h-4 w-4 items-center justify-center rounded border text-[8px]"
              initial={{
                borderColor: "rgba(255,255,255,0.25)",
                backgroundColor: "transparent",
              }}
              animate={
                t.done
                  ? {
                      borderColor: "rgba(111,191,138,1)",
                      backgroundColor: "rgba(111,191,138,1)",
                      color: "#0a0e12",
                    }
                  : {
                      borderColor: "rgba(255,255,255,0.25)",
                    }
              }
              transition={{ delay: 0.55 + i * 0.16, duration: 0.3 }}
            >
              {t.done ? "✓" : ""}
            </motion.span>
            <span className={t.done ? "text-[#8ba3b8] line-through" : "text-white"}>
              {t.text}
            </span>
          </motion.li>
        ))}
      </ul>
      <p className="mt-2.5 text-[10px] text-[#8ba3b8]">
        Today only checks them off
      </p>
    </div>
  );
}

function NightCard({
  sleep,
  wake,
  iconRef,
}: {
  sleep: string;
  wake: string;
  iconRef: Ref<AnimatedIconHandle>;
}) {
  return (
    <div className="flex min-h-[11.5rem] flex-col justify-center rounded-2xl border border-[#f0b45a]/25 bg-[#081018]/80 px-4 py-4 text-center backdrop-blur-md">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-[#f0b45a]/40 bg-[#f0b45a]/10 text-[#f0b45a]">
        <MoonIcon ref={iconRef} size={22} />
      </div>
      <p className="mt-2.5 text-[10px] uppercase tracking-[0.2em] text-[#f0b45a]">
        Night closed
      </p>
      <p className="font-display mt-1 text-[1.65rem] text-white">Sleep well</p>
      <p className="mt-1.5 text-[11px] text-[#c5ced6]">
        Tomorrow is set · wake {wake} · sleep {sleep}
      </p>
    </div>
  );
}
