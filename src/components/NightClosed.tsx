"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { MoonIcon } from "@/components/animated-icons/moon";
import type { AnimatedIconHandle } from "@/components/animated-icons/use-icon-animation";
import { cn } from "@/lib/utils";

type Props = {
  sleepGoal: string;
  wakeGoal: string;
  className?: string;
};

export function NightClosed({ sleepGoal, wakeGoal, className }: Props) {
  const moonRef = useRef<AnimatedIconHandle>(null);

  useEffect(() => {
    moonRef.current?.startAnimation();
    const id = window.setInterval(() => moonRef.current?.startAnimation(), 2800);
    return () => window.clearInterval(id);
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative overflow-hidden rounded-3xl border border-[var(--color-dawn)]/25 bg-[#081018] px-5 py-8 text-center sm:px-8",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 night-closed-glow" />
      {STARS.map((s) => (
        <motion.span
          key={s.id}
          className="pointer-events-none absolute h-1 w-1 rounded-full bg-[var(--color-dawn)]"
          style={{ left: s.left, top: s.top }}
          animate={{ opacity: [0.15, 0.9, 0.15], scale: [0.8, 1.3, 0.8] }}
          transition={{ duration: s.dur, repeat: Infinity, delay: s.delay }}
        />
      ))}

      <motion.div
        initial={{ rotate: -18, scale: 0.7, opacity: 0 }}
        animate={{ rotate: 0, scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.08 }}
        className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-dawn)]/40 bg-[var(--color-dawn)]/10 text-[var(--color-dawn)]"
      >
        <MoonIcon ref={moonRef} size={32} />
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="relative mt-5 text-xs uppercase tracking-[0.28em] text-[var(--color-dawn)]"
      >
        Night closed
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32 }}
        className="font-display relative mt-2 text-3xl text-white"
      >
        Sleep well
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.42 }}
        className="relative mx-auto mt-3 max-w-sm text-sm text-[var(--color-mist)]"
      >
        Tomorrow is set. Phone down. Wake {wakeGoal}. That plan is waiting on
        Today in the morning.
      </motion.p>
      <p className="relative mt-5 text-xs tabular-nums text-[var(--color-cloud)]">
        Sleep window target {sleepGoal}
      </p>
    </motion.section>
  );
}

const STARS = [
  { id: 1, left: "12%", top: "18%", dur: 2.4, delay: 0.1 },
  { id: 2, left: "78%", top: "22%", dur: 3.1, delay: 0.4 },
  { id: 3, left: "88%", top: "58%", dur: 2.2, delay: 0.8 },
  { id: 4, left: "18%", top: "72%", dur: 2.8, delay: 0.2 },
  { id: 5, left: "62%", top: "14%", dur: 3.4, delay: 1.1 },
  { id: 6, left: "42%", top: "80%", dur: 2.6, delay: 0.6 },
];
