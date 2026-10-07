"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

export function LandingHero() {
  const reduce = useReducedMotion();
  return (
    <section
      className="landing-hero relative isolate flex min-h-[100svh] flex-col px-5 pb-28 pt-28 sm:px-10 sm:pb-20 sm:pt-32"
      aria-labelledby="hero-title"
    >
      <img
        src="/images/landing-hero.jpg"
        alt=""
        width={1672}
        height={941}
        fetchPriority="high"
        decoding="async"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[38%_46%]"
      />
      <div className="landing-hero-scrim pointer-events-none absolute inset-0" aria-hidden />
      <motion.div
        className="landing-hero-copy relative z-10 mx-auto mt-auto w-full max-w-5xl"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-xl">
          <a href="#new" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 text-xs text-[var(--landing-accent)]">
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" /> Dawn Beta · See what’s new ↗
          </a>
          <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--landing-muted)] sm:mt-8">Make room for your morning</p>
          <h1 id="hero-title" className="mt-3 font-display text-[clamp(4.5rem,10vw,7rem)] leading-none tracking-[-0.055em]">Dawn</h1>
          <p className="mt-3 max-w-[29ch] font-display text-2xl leading-tight sm:mt-5 sm:text-4xl">A quieter start.<br />A day you follow through.</p>
          <p className="mt-5 max-w-[36ch] text-sm leading-6 text-[var(--landing-muted)] sm:text-[15px] sm:leading-7">Wake, build your habits, make time for your work, and close the night. One place for the small things that add up.</p>
          <div className="mt-5 flex flex-wrap items-center gap-5 sm:mt-7"><Link href="/signup" className="dawn-btn">Open Dawn</Link><a href="#new" className="py-3 text-sm text-[var(--landing-accent)] underline underline-offset-4">Explore the beta ↓</a></div>
          <p className="mt-7 text-[11px] tracking-wide text-[var(--landing-muted)]">Wake · Habits · Missions · Study · Night</p>
        </div>
      </motion.div>
    </section>
  );
}
