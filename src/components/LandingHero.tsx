"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

export function LandingHero() {
  const reduce = useReducedMotion();
  return (
    <section className="landing-hero px-5 pb-16 pt-28 sm:px-10 sm:pb-24 sm:pt-36" aria-labelledby="hero-title">
      <div className="mx-auto grid max-w-5xl items-center gap-6 sm:gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <a href="#new" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 text-xs text-[var(--landing-accent)]">
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" /> Dawn Beta · See what’s new ↗
          </a>
          <p className="mt-5 sm:mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--landing-muted)]">Make room for your morning</p>
          <h1 id="hero-title" className="mt-3 font-display text-[clamp(4.5rem,10vw,7rem)] leading-none tracking-[-0.055em]">Dawn</h1>
          <p className="mt-3 sm:mt-5 max-w-[29ch] font-display text-2xl leading-tight sm:text-4xl">A quieter start.<br />A day you follow through.</p>
          <p className="hidden sm:block mt-5 max-w-[36ch] text-[15px] leading-7 text-[var(--landing-muted)]">Wake, build your habits, make time for your work, and close the night. One place for the small things that add up.</p>
          <div className="mt-5 sm:mt-7 flex flex-wrap items-center gap-5"><Link href="/signup" className="dawn-btn">Open Dawn</Link><a href="#new" className="py-3 text-sm text-[var(--landing-accent)] underline underline-offset-4">Explore the beta ↓</a></div>
          <p className="hidden sm:block mt-7 text-[11px] tracking-wide text-[var(--landing-muted)]">Wake · Habits · Missions · Study · Night</p>
        </motion.div>
        <motion.figure
          className="min-w-0"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: reduce ? 0 : 0.1 }}
        >
          <img src="/images/landing-hero.jpg" alt="Morning sunlight finding its way through soft curtains" width={1800} height={1467} fetchPriority="high" className="block aspect-[4/3] w-full rounded-[1.75rem] object-cover shadow-[0_18px_60px_#372b1814] object-[78%_65%] sm:aspect-[5/4] lg:aspect-[4/5]" />
          <figcaption className="flex flex-wrap items-center justify-between gap-2 px-1 pt-3 text-[11px] text-[var(--landing-muted)]"><span>Let a little light in.</span><span className="font-mono text-[var(--landing-accent)]">A new day, again.</span></figcaption>
        </motion.figure>
        <p className="text-sm leading-6 text-[var(--landing-muted)] sm:hidden">Wake, build your habits, make time for your work, and close the night. One place for the small things that add up.</p>
      </div>
    </section>
  );
}
