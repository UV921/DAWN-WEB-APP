"use client";

import { motion } from "motion/react";

export type BetaFeature = "missions" | "consistency" | "night" | "themes";

const WEEK = [35, 60, 45, 80, 65, 100, 85, 55, 75, 90, 65, 100, 80, 95];

export function LandingBetaPreview({ id, still }: { id: BetaFeature; still: boolean }) {
  const reveal = (delay: number) => ({
    initial: still ? false as const : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay: still ? 0 : delay },
  });

  return (
    <div className="min-h-[15rem] text-[var(--landing-text)]">
      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--landing-muted)]">Feature preview · sample data</p>
      {id === "missions" && <>
        <p className="mt-4 font-display text-2xl">Build something real.</p>
        <p className="mt-1 text-xs text-[var(--landing-muted)]">Launch my portfolio · 14-day mission</p>
        <div className="mt-4 space-y-2">
          {["Sketch the idea", "Build the first page", "Share it with the world"].map((task, index) => (
            <motion.div key={task} {...reveal(index * 0.45)} className="flex items-center gap-2 rounded-lg border border-[var(--landing-border)] p-2.5 text-xs">
              <motion.span initial={false} animate={{ backgroundColor: index < 2 ? "#f0b45a" : "var(--landing-track)" }} transition={{ delay: still ? 0 : index * 0.45 + 0.2 }} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#071018]">{index < 2 ? "✓" : ""}</motion.span>
              <span>{task}</span>
            </motion.div>
          ))}
        </div>
        <ProgressBar value={67} still={still} />
        <p className="mt-2 text-xs text-[var(--landing-accent)]">2 of 3 steps complete</p>
      </>}
      {id === "consistency" && <>
        <p className="mt-4 font-display text-2xl">Small wins add up.</p>
        <p className="mt-1 text-xs text-[var(--landing-muted)]">Your habit history, right on Today.</p>
        <div className="mt-6 flex h-24 items-end gap-1" aria-hidden="true">
          {WEEK.map((height, index) => <motion.div key={index} initial={still ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.5, delay: still ? 0 : index * 0.06 }} className="min-w-0 flex-1 origin-bottom rounded-t bg-[#f0b45a]" style={{ height: `${height}%`, opacity: 0.35 + height / 160 }} />)}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-[var(--landing-muted)]"><span>Earlier</span><span>Today</span></div>
        <motion.p {...reveal(1)} className="mt-5 rounded-lg bg-[#6fbf8a]/10 p-3 text-xs text-[var(--landing-success)]">Tap a day. See what you completed.</motion.p>
      </>}
      {id === "night" && <>
        <p className="mt-4 font-display text-2xl">Leave tomorrow ready.</p>
        <p className="mt-1 text-xs text-[var(--landing-muted)]">A little closure before you sleep.</p>
        <div className="mt-5 space-y-3">
          {[['Mission check-in', 'Worked on it today'], ['Tomorrow’s plan', 'Read one chapter'], ['Wake goal', '06:00']].map(([label, value], index) => <motion.div key={label} {...reveal(index * 0.5)} className="flex items-center justify-between gap-3 border-b border-[var(--landing-border)] pb-3 text-xs"><span className="text-[var(--landing-muted)]">{label}</span><span className="max-w-[55%] text-right">{value}</span></motion.div>)}
        </div>
        <motion.p {...reveal(1.6)} className="mt-4 text-xs text-[var(--landing-accent)]">Tomorrow is set. Rest well.</motion.p>
      </>}
      {id === "themes" && <>
        <p className="mt-4 font-display text-2xl">A different kind of dawn.</p>
        <p className="mt-1 text-xs text-[var(--landing-muted)]">Light or dark. Your landing page, your choice.</p>
        <motion.div initial={false} animate={{ backgroundColor: still ? "#faf7f0" : ["#0d131a", "#faf7f0"], color: still ? "#202a33" : ["#f3f0e9", "#202a33"] }} transition={{ duration: still ? 0 : 1.5, delay: still ? 0 : 0.5 }} className="mt-5 rounded-xl border border-[var(--landing-border)] p-4">
          <div className="flex items-center justify-between"><span className="font-display text-2xl">Dawn</span><span className="rounded-full border border-current/25 px-2 py-1 text-[10px]">☀ / ☾</span></div>
          <p className="mt-3 text-xs">One screen for the day.</p>
          <div className="mt-4 h-1.5 w-3/4 rounded bg-current opacity-20" />
          <div className="mt-2 h-1.5 w-1/2 rounded bg-current opacity-10" />
        </motion.div>
        <p className="mt-4 text-xs text-[var(--landing-accent)]">Try the toggle in the navigation.</p>
      </>}
    </div>
  );
}

function ProgressBar({ value, still }: { value: number; still: boolean }) {
  return <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--landing-track)]"><motion.div initial={still ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1, delay: still ? 0 : 0.5 }} className="h-full origin-left rounded-full bg-[#f0b45a]" style={{ width: `${value}%` }} /></div>;
}
