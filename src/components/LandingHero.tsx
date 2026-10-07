"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { CloudShader } from "@/components/ui/cloud-shader";
import { LandingHeroFilm } from "@/components/LandingHeroFilm";

export function LandingHero() {
  const reduce = useReducedMotion();
  return (
    <section aria-labelledby="hero-title">
      <CloudShader className="h-auto min-h-[100svh] overflow-visible">
        <div className="mx-auto flex w-full max-w-5xl flex-col px-5 pb-16 pt-28 text-[#17324d] sm:px-10 sm:pb-24 sm:pt-36">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#17324d]/70">
              Make room for your morning
            </p>
            <h1
              id="hero-title"
              className="mt-3 font-display text-[clamp(4.5rem,10vw,7rem)] leading-none tracking-[-0.055em]"
            >
              Dawn
            </h1>
            <p className="mt-3 max-w-[16ch] font-display text-2xl leading-tight sm:mt-5 sm:text-4xl">
              A quieter start.
              <br />
              A day you follow through.
            </p>
            <p className="mt-5 max-w-[38ch] text-sm leading-6 text-[#17324d]/80 sm:text-[15px] sm:leading-7">
              Wake, build your habits, make time for your work, and close the night. One place for the small things that add up.
            </p>
            <div className="mt-6">
              <Link href="/signup" className="dawn-btn">
                Open Dawn
              </Link>
            </div>
          </motion.div>

          <motion.img
            src="/images/landing-hero.jpg"
            alt="A dirt road through golden fields toward a stone house and two trees"
            width={1672}
            height={941}
            fetchPriority="high"
            decoding="async"
            className="mt-12 block aspect-[16/9] w-full rounded-[1.75rem] object-cover shadow-[0_24px_70px_rgba(18,42,72,0.28)]"
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: reduce ? 0 : 0.08 }}
          />

          <motion.div
            className="mt-36 overflow-hidden rounded-[1.75rem] border border-white/50 bg-[var(--landing-surface)] shadow-[0_24px_70px_rgba(18,42,72,0.28)] sm:mt-16"
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: reduce ? 0 : 0.16 }}
          >
            <div className="flex items-baseline justify-between gap-3 border-b border-[var(--landing-border)] px-5 py-4">
              <h2 className="font-display text-xl text-[var(--landing-text)]">Today</h2>
              <p className="text-[12px] text-[var(--landing-muted)]">What you see after you sign in</p>
            </div>
            <div className="h-[34rem] sm:h-[40rem]">
              <LandingHeroFilm />
            </div>
          </motion.div>
        </div>
      </CloudShader>
    </section>
  );
}
