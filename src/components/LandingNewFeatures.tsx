"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import Link from "next/link";
import { LandingBetaPreview } from "@/components/LandingBetaPreview";
import { IconGoogle } from "@/components/icons";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;
const SCENE_MS = 6500;

const FEATURES = [
  {
    id: "missions",
    kicker: "Missions",
    title: "Big plans. Small steps.",
    body: "Set your own mission dates, break the work into a checklist, and track your progress from Today.",
  },
  {
    id: "consistency",
    kicker: "Consistency",
    title: "See yourself showing up",
    body: "Six weeks of habit history in a compact graph at the bottom of Today. Tap any day to see what you completed.",
  },
  {
    id: "night",
    kicker: "Night check-in",
    title: "Close today. Set up tomorrow.",
    body: "Check in on your mission, plan tomorrow, and set your wake goal before closing the night.",
  },
  {
    id: "themes",
    kicker: "Light + dark",
    title: "Choose your kind of dawn",
    body: "Switch the landing page between light and dark. Your choice stays saved for your next visit, on mobile too.",
  },
  {
    id: "google",
    kicker: "Sign in",
    title: "Google in one tap",
    body: "Start Dawn with Google. Discord still works. Same email, same account.",
  },
  {
    id: "code",
    kicker: "Friends",
    title: "Add anyone with a code",
    body: "Copy your friend code. They paste it. Google or Discord — same step.",
  },
  {
    id: "board",
    kicker: "Board",
    title: "Rank habits and study",
    body: "Who stayed consistent. Who sat in the room. Combined score.",
  },
  {
    id: "study",
    kicker: "Hours",
    title: "Study time that counts",
    body: "Sit in a marked voice room. Dawn pings you what you’re doing and counts the hours.",
  },
] as const;

export function LandingNewFeatures() {
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { margin: "-80px" });
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const still = Boolean(reduce) || !inView || paused;
  const feature = FEATURES[step];

  useEffect(() => {
    if (still) return;
    const id = window.setInterval(() => {
      setStep((n) => (n + 1) % FEATURES.length);
    }, SCENE_MS);
    return () => window.clearInterval(id);
  }, [still, step]);

  return (
    <section
      id="new"
      ref={root}
      aria-label="What's new in Dawn Beta"
      className="scroll-mt-16 border-t border-[var(--landing-border)] px-5 py-16 sm:px-10 sm:py-24"
    >
      <div className="mx-auto max-w-5xl">
        <div className="max-w-xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--landing-accent)]">
            Inside the beta
          </p>
          <h2 className="font-display mt-2 text-[1.85rem] leading-tight text-[var(--landing-text)] sm:text-[2.35rem]">
            More ways to make the day count
          </h2>
          <p className="mt-3 max-w-[40ch] text-[15px] text-[var(--landing-muted)]">
            Missions, daily consistency, and a calmer night routine — alongside
            friends, study hours, and your shared board. Explore what’s in Dawn now.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--landing-muted)]">
          <span>{String(step + 1).padStart(2, "0")} / {String(FEATURES.length).padStart(2, "0")} · Feature tour</span>
          <button type="button" onClick={() => setPaused((value) => !value)} aria-pressed={paused} disabled={Boolean(reduce)} className="min-h-11 rounded-full border border-[var(--landing-border)] px-4 text-[var(--landing-text)] disabled:opacity-60">
            {reduce ? "Motion reduced" : paused ? "Play tour" : "Pause tour"}
          </button>
        </div>

        <motion.div
          className="landing-demo relative mt-8 overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0d131a]"
          initial={reduce ? false : { opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.85, ease: EASE }}
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_78%_42%,rgba(240,180,90,0.07),transparent_58%)]"
            aria-hidden
          />

          <div className="relative z-10 flex flex-col justify-between gap-6 p-5 sm:p-6 min-h-[34rem] sm:min-h-[32rem] lg:min-h-[28rem] lg:flex-row lg:items-end lg:p-8">
            <motion.div key={feature.id} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="min-w-0 max-w-md">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--landing-accent)]">
                {feature.kicker}
              </p>
              <h3 className="font-display mt-2 text-[1.7rem] leading-tight text-[var(--landing-text)] sm:text-[2.1rem]">
                {feature.title}
              </h3>
              <p className="mt-3 max-w-[32ch] text-[15px] leading-relaxed text-[var(--landing-muted)] lg:text-[#d6e2ec]/90">
                {feature.body}
              </p>
              <Link href="/signup" onFocus={() => setPaused(true)} className="dawn-btn mt-6">
                Open Dawn
              </Link>
            </motion.div>
            <FeatureOverlay id={feature.id} reduce={Boolean(reduce) || !inView} />
          </div>
        </motion.div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {FEATURES.map((f, i) => {
            const active = i === step;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => { setStep(i); setPaused(true); }}
                onFocus={() => setPaused(true)}
                aria-pressed={active}
                aria-controls="landing-feature-preview"
                className={cn(
                  "rounded-xl border px-3 py-3 text-left transition sm:px-4",
                  active
                    ? "border-[#f0b45a]/50 bg-[#f0b45a]/10"
                    : "border-[var(--landing-border)] bg-[var(--landing-inset)] hover:border-[var(--landing-accent)]"
                )}
              >
                <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--landing-accent)]">
                  {f.kicker}
                </p>
                <p className="mt-1 text-[13px] font-medium leading-snug text-[var(--landing-text)]">
                  {f.title}
                </p>
                <span
                  className="mt-3 block h-0.5 overflow-hidden rounded-full bg-white/10"
                  aria-hidden
                >
                  <motion.span
                    key={active ? `run-${step}-${still}` : "idle"}
                    className="block h-full w-full origin-left bg-[#f0b45a]"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: active ? 1 : 0 }}
                    transition={
                      active && !still
                        ? { duration: SCENE_MS / 1000, ease: "linear" }
                        : { duration: 0.25, ease: EASE }
                    }
                  />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FeatureOverlay({
  id,
  reduce,
}: {
  id: (typeof FEATURES)[number]["id"];
  reduce: boolean;
}) {
  return (
    <motion.div
      id="landing-feature-preview"
      key={id}
      initial={reduce ? false : { opacity: 0, y: 22, rotateX: 18 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.7, ease: EASE }}
      style={{ transformPerspective: 1000, transformStyle: "preserve-3d" }}
      className="w-full max-w-none shrink-0 sm:max-w-[18.5rem]"
    >
      <div className="mac-chassis p-1.5 sm:p-2">
        <div className="mac-bezel">
          <div className="mac-glass min-h-[17rem] rounded-[15px] bg-[#0a121a]/95 p-4">
      {(id === "missions" || id === "consistency" || id === "night" || id === "themes") && <LandingBetaPreview id={id} still={reduce} />}
      {id === "google" ? (
        <>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--landing-accent)]">
            Create account
          </p>
          <p className="font-display mt-1 text-xl text-[var(--landing-text)]">Start your Dawn</p>
          <div className="mt-4 flex flex-col gap-2">
            <span className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-[13px] font-semibold text-[#1f1f1f]">
              <IconGoogle size={16} />
              Sign up with Google
            </span>
            <span className="inline-flex items-center justify-center rounded-full bg-[#5865f2] px-4 py-2.5 text-[13px] font-medium text-[var(--landing-text)]">
              Sign up with Discord
            </span>
          </div>
        </>
      ) : null}

      {id === "code" ? (
        <>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[#8ba3b8]">
            Your friend code
          </p>
          <p className="mt-2 font-mono text-[1.65rem] tracking-[0.18em] text-[var(--landing-accent)]">
            K7M2QP4X
          </p>
          <p className="mt-2 text-[12px] text-[#8ba3b8]">
            Send it. They paste it. You’re on the board.
          </p>
          <span className="mt-4 inline-flex rounded-full bg-[#f0b45a] px-4 py-2 text-[12px] font-semibold text-[#071018]">
            Add friend
          </span>
        </>
      ) : null}

      {id === "board" ? (
        <>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--landing-accent)]">
            Habits + study
          </p>
          <ul className="mt-3 space-y-2">
            {[
              { place: "1", name: "You", score: "86 · 12h", you: true },
              { place: "2", name: "Ira", score: "74 · 9h" },
              { place: "3", name: "Leo", score: "61 · 7h" },
            ].map((row) => (
              <li
                key={row.place}
                className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${
                  row.you ? "bg-[#f0b45a]/15" : "bg-white/[0.04]"
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f0b45a] text-[11px] font-semibold text-[#071018]">
                  {row.place}
                </span>
                <span className="flex-1 text-[13px] text-[var(--landing-text)]">{row.name}</span>
                <span className="font-mono text-[11px] text-[var(--landing-accent)]">
                  {row.score}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {id === "study" ? (
        <>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[#6fbf8a]">
            Study · live
          </p>
          <p className="font-display mt-2 text-[2rem] tabular-nums leading-none text-[var(--landing-text)]">
            1h 42m
          </p>
          <p className="mt-2 text-[12px] text-[#8ba3b8]">
            Voice room counting. It lands on the board.
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-[#f0b45a]"
              initial={reduce ? { width: "68%" } : { width: "0%" }}
              animate={{ width: "68%" }}
              transition={{ duration: 1.1, ease: EASE }}
            />
          </div>
        </>
      ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
