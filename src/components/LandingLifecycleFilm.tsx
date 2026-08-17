"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";
import { ChartColumnIcon } from "@/components/animated-icons/chart-column";
import { ListTodoIcon } from "@/components/animated-icons/list-todo";
import { GraduationCapIcon } from "@/components/ui/graduation-cap";
import type { GraduationCapIconHandle } from "@/components/ui/graduation-cap";
import type { AnimatedIconHandle } from "@/components/animated-icons/use-icon-animation";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;
const SCENE_MS = 3800;

const STEPS = [
  { id: "lists", label: "Lists", hint: "Name a list. Check it off." },
  { id: "study", label: "Study", hint: "Sit in the marked room." },
  { id: "share", label: "Share", hint: "Gold card. PNG." },
  { id: "stats", label: "Stats", hint: "The honest week." },
] as const;

const BUY = [
  { text: "AirPods", done: false },
  { text: "Notebook", done: true },
  { text: "White tee", done: false },
  { text: "Desk lamp", done: false },
];

const WEEK_BARS = [12, 48, 0, 95, 70, 22, 80];
const WEEK_L = ["M", "T", "W", "T", "F", "S", "S"];

type Props = { className?: string };

export function LandingLifecycleFilm({ className }: Props) {
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { margin: "-80px" });
  const [step, setStep] = useState(0);
  const listIcon = useRef<AnimatedIconHandle>(null);
  const capIcon = useRef<GraduationCapIconHandle>(null);
  const chartIcon = useRef<AnimatedIconHandle>(null);

  useEffect(() => {
    if (reduce || !inView) return;
    const id = window.setInterval(() => {
      setStep((n) => (n + 1) % STEPS.length);
    }, SCENE_MS);
    return () => window.clearInterval(id);
  }, [reduce, inView]);

  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => {
      if (step === 0) listIcon.current?.startAnimation();
      if (step === 1) capIcon.current?.startAnimation();
      if (step === 3) chartIcon.current?.startAnimation();
    }, 200);
    return () => window.clearTimeout(t);
  }, [step, reduce]);

  return (
    <div
      ref={root}
      className={cn(
        "relative overflow-hidden bg-[#0a0e12]",
        className
      )}
      aria-label="Dawn loop: named lists, study hours, share a card, read the week"
    >
      <div className="border-b border-white/[0.08] px-4 pt-3">
        <div className="flex gap-1.5 sm:gap-2">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(i)}
              className={`flex-1 rounded-full px-2 py-1.5 text-[10px] tracking-wide transition sm:text-[11px] ${
                step === i
                  ? "bg-[#f0b45a] font-semibold text-[#0a0e12]"
                  : "text-[#8ba3b8] hover:text-white"
              }`}
            >
              <span className="font-mono opacity-70">{`0${i + 1}`}</span>{" "}
              {s.label}
            </button>
          ))}
        </div>
        <div className="mt-3 h-0.5 overflow-hidden bg-white/10">
          <motion.div
            key={step}
            className="h-full origin-left bg-[#f0b45a]"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: inView && !reduce ? 1 : 1 }}
            transition={{
              duration: reduce || !inView ? 0 : SCENE_MS / 1000,
              ease: "linear",
            }}
          />
        </div>
      </div>

      <div className="relative min-h-[22rem] p-5 sm:min-h-[24rem]">
        <AnimatePresence mode="wait">
          {step === 0 ? (
            <Scene key="lists">
              <div className="mb-4 flex items-center gap-2 text-[#f0b45a]">
                <ListTodoIcon ref={listIcon} size={22} />
                <p className="text-[11px] uppercase tracking-[0.16em]">
                  {STEPS[0].hint}
                </p>
              </div>
              <p className="font-display text-[1.85rem] text-[#f0b45a]">
                <TypeLine text="Want to buy" reduce={!!reduce} />
              </p>
              <p className="mt-1 text-[12px] text-[#8ba3b8]">Named list · today</p>
              <ul className="mt-5 space-y-2">
                {BUY.map((item, i) => (
                  <motion.li
                    key={item.text}
                    className="flex items-center gap-3 steel-plate-sm rounded-xl bg-black/30 px-3 py-2.5"
                    initial={reduce ? false : { opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.12 + i * 0.12, duration: 0.4, ease: EASE }}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded border text-[10px] ${
                        item.done
                          ? "border-[#6fbf8a] bg-[#6fbf8a] text-[#0a0e12]"
                          : "border-[#f0b45a]/60"
                      }`}
                    >
                      {item.done ? "✓" : ""}
                    </span>
                    <span
                      className={
                        item.done ? "text-[#8ba3b8] line-through" : "text-white"
                      }
                    >
                      {item.text}
                    </span>
                  </motion.li>
                ))}
              </ul>
              <motion.p
                className="mt-4 inline-flex rounded-full border border-[#f0b45a]/40 bg-[#f0b45a]/10 px-3 py-1.5 text-[11px] text-[#f0b45a]"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.4 }}
              >
                Share PNG
              </motion.p>
            </Scene>
          ) : null}

          {step === 1 ? (
            <Scene key="study">
              <div className="mb-4 flex items-center gap-2 text-[#f0b45a]">
                <GraduationCapIcon ref={capIcon} size={26} />
                <p className="text-[11px] uppercase tracking-[0.16em]">
                  {STEPS[1].hint}
                </p>
              </div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#6fbf8a]">
                In session
              </p>
              <p className="font-display mt-2 text-[clamp(1.6rem,6vw,2.6rem)] leading-none text-white">
                <StudyClock reduce={!!reduce} />
              </p>
              <p className="mt-2 text-[14px] text-[#9aa6b2]">
                Today · counting while you’re in the marked VC
              </p>
              <div className="mt-6 flex items-end gap-1.5">
                {WEEK_BARS.map((h, i) => (
                  <motion.div
                    key={WEEK_L[i]}
                    className="flex flex-1 flex-col items-center gap-1"
                  >
                    <motion.div
                      className={`w-full rounded-sm ${
                        i === 6 ? "bg-[#f0b45a]" : h > 0 ? "bg-white/30" : "bg-white/10"
                      }`}
                      initial={reduce ? { height: Math.max(6, h * 0.7) } : { height: 6 }}
                      animate={{ height: Math.max(6, h * 0.7) }}
                      transition={{ delay: 0.1 + i * 0.07, duration: 0.5, ease: EASE }}
                    />
                    <span className="text-[10px] text-[#8ba3b8]">{WEEK_L[i]}</span>
                  </motion.div>
                ))}
              </div>
              <p className="mt-4 text-[12px] text-[#6b7785]">
                Today only. Totals on Stats.
              </p>
            </Scene>
          ) : null}

          {step === 2 ? (
            <Scene key="share">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#f0b45a]">
                {STEPS[2].hint}
              </p>
              <motion.div
                className="relative mt-4 overflow-hidden steel-plate rounded-2xl bg-[#071018] px-5 py-5"
                initial={reduce ? false : { opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.55, ease: EASE }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_at_top,rgba(240,180,90,0.28),transparent_70%)]"
                />
                <p className="relative text-[11px] tracking-[0.28em] text-[#f0b45a]">
                  D A W N
                </p>
                <p className="font-display relative mt-3 text-[1.7rem] text-[#f0b45a]">
                  This week
                </p>
                <p className="relative mt-1 text-[12px] text-[#8ba3b8]">
                  uv · Sat, Aug 15
                </p>
                <div className="relative mt-5 grid grid-cols-2 gap-2">
                  {[
                    ["Habits", "72%"],
                    ["Tasks", "50%"],
                    ["Mornings", "4/7"],
                    ["Study", "6h 10m"],
                  ].map(([k, v], i) => (
                    <motion.div
                      key={k}
                      className="steel-plate-sm rounded-xl bg-white/[0.04] px-3 py-2.5"
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.08, duration: 0.35 }}
                    >
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[#8ba3b8]">
                        {k}
                      </p>
                      <p className="font-display mt-0.5 text-lg text-[#f0b45a]">
                        {v}
                      </p>
                    </motion.div>
                  ))}
                </div>
                <p className="relative mt-4 text-[11px] text-white/35">
                  Made with Dawn
                </p>
              </motion.div>
            </Scene>
          ) : null}

          {step === 3 ? (
            <Scene key="stats">
              <div className="mb-4 flex items-center gap-2 text-[#f0b45a]">
                <ChartColumnIcon ref={chartIcon} size={22} />
                <p className="text-[11px] uppercase tracking-[0.16em]">
                  {STEPS[3].hint}
                </p>
              </div>
              <p className="font-display text-[1.7rem] leading-tight text-white">
                You finished the morning on 4 of 7 days.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  ["Habits", "72%"],
                  ["Study", "6h"],
                  ["Streak", "7d"],
                ].map(([k, v], i) => (
                  <motion.div
                    key={k}
                    className="steel-plate-sm rounded-xl bg-white/[0.04] px-3 py-3"
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.4, ease: EASE }}
                  >
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[#8ba3b8]">
                      {k}
                    </p>
                    <p className="font-display mt-1 text-xl text-[#f0b45a]">{v}</p>
                  </motion.div>
                ))}
              </div>
              <div className="mt-5 flex h-24 items-end gap-1">
                {[40, 80, 55, 90, 30, 70, 95, 60, 45, 85, 50, 75, 20, 88].map(
                  (h, i) => (
                    <motion.div
                      key={i}
                      className="flex-1 rounded-sm bg-gradient-to-t from-[#e07a3a] to-[#f0b45a]"
                      initial={reduce ? { height: `${h}%` } : { height: "8%" }}
                      animate={{ height: `${h}%` }}
                      transition={{ delay: 0.15 + i * 0.04, duration: 0.45, ease: EASE }}
                    />
                  )
                )}
              </div>
              <p className="mt-3 text-[12px] text-[#6b7785]">
                Gold habits. Green tasks.
              </p>
            </Scene>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Scene({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

function TypeLine({ text, reduce }: { text: string; reduce: boolean }) {
  const [shown, setShown] = useState(reduce ? text : "");
  useEffect(() => {
    if (reduce) {
      setShown(text);
      return;
    }
    setShown("");
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, 55);
    return () => window.clearInterval(id);
  }, [text, reduce]);
  return (
    <>
      {shown}
      {shown.length < text.length ? (
        <span className="ml-0.5 inline-block h-[0.85em] w-[2px] translate-y-[0.08em] bg-[#f0b45a]" />
      ) : null}
    </>
  );
}

function StudyClock({ reduce }: { reduce: boolean }) {
  const [mins, setMins] = useState(reduce ? 102 : 0);
  useEffect(() => {
    if (reduce) {
      setMins(102);
      return;
    }
    setMins(0);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1400);
      const eased = 1 - (1 - t) ** 3;
      setMins(Math.round(102 * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return (
    <>
      {h}h {m}m
    </>
  );
}
