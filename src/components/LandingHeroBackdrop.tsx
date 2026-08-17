"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;
const STEP_MS = 2800;

const STEPS = [
  { id: "wake", label: "Wake", line: "In the morning window." },
  { id: "lists", label: "Lists", line: "Tasks for the day." },
  { id: "study", label: "Study", line: "Hours that count." },
  { id: "night", label: "Night", line: "Then close it." },
] as const;

export function LandingHeroBackdrop() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const reduce = useReducedMotion();
  const still = Boolean(reduce) || !inView;
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (still) return;
    const id = window.setInterval(() => {
      setStep((n) => (n + 1) % STEPS.length);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [still]);

  const current = STEPS[step];

  return (
    <div ref={ref} className="hero-explain" aria-hidden>
      <div className="hero-explain-panel">
        <div className={cn("hero-explain-wash", `is-${current.id}`)} />
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            className="hero-explain-mark"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            {current.id === "wake" ? <WakeMark /> : null}
            {current.id === "lists" ? <ListsMark /> : null}
            {current.id === "study" ? <StudyMark /> : null}
            {current.id === "night" ? <NightMark /> : null}
          </motion.div>
        </AnimatePresence>
        <p className="hero-explain-kicker">{current.label}</p>
        <p className="hero-explain-line">{current.line}</p>
        <ol className="hero-explain-steps">
          {STEPS.map((s, i) => (
            <li
              key={s.id}
              className={cn("hero-explain-dot", i === step && "is-on")}
            >
              {s.label}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function WakeMark() {
  return (
    <span className="hero-mark hero-mark-wake">
      <i />
    </span>
  );
}

function ListsMark() {
  return (
    <span className="hero-mark hero-mark-lists">
      <i />
      <i />
      <i />
    </span>
  );
}

function StudyMark() {
  return (
    <span className="hero-mark hero-mark-study">
      <i />
      <b>1h</b>
    </span>
  );
}

function NightMark() {
  return <span className="hero-mark hero-mark-night" />;
}
