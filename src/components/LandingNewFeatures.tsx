"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import Link from "next/link";
import { IconGoogle } from "@/components/icons";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;
const SCENE_MS = 4800;

const FEATURES = [
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
  const still = Boolean(reduce) || !inView;
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
      className="scroll-mt-16 border-t border-white/[0.08] px-5 py-16 sm:px-10 sm:py-24"
    >
      <div className="mx-auto max-w-5xl">
        <div className="max-w-xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#f0b45a]">
            New
          </p>
          <h2 className="font-display mt-2 text-[1.85rem] leading-tight text-white sm:text-[2.35rem]">
            What Dawn gives you now
          </h2>
          <p className="mt-3 max-w-[40ch] text-[15px] text-[#9aa6b2]">
            Google sign-in, a friend code, and a board that ranks habit
            consistency against study hours.
          </p>
        </div>

        <motion.div
          className="relative mt-8 overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0d131a]"
          initial={reduce ? false : { opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.85, ease: EASE }}
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_78%_42%,rgba(240,180,90,0.07),transparent_58%)]"
            aria-hidden
          />

          <div className="relative z-10 flex flex-col justify-between gap-6 p-5 sm:p-6 lg:min-h-[32rem] lg:flex-row lg:items-end lg:p-8">
            <div className="max-w-md">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#f0b45a]">
                {feature.kicker}
              </p>
              <h3 className="font-display mt-2 text-[1.7rem] leading-tight text-white sm:text-[2.1rem]">
                {feature.title}
              </h3>
              <p className="mt-3 max-w-[32ch] text-[15px] leading-relaxed text-[#9aa6b2] lg:text-[#d6e2ec]/90">
                {feature.body}
              </p>
              <Link href="/signup" className="dawn-btn mt-6">
                Open Dawn
              </Link>
            </div>
            <FeatureOverlay id={feature.id} reduce={Boolean(reduce)} />
          </div>
        </motion.div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {FEATURES.map((f, i) => {
            const active = i === step;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setStep(i)}
                className={cn(
                  "rounded-xl border px-3 py-3 text-left transition sm:px-4",
                  active
                    ? "border-[#f0b45a]/50 bg-[#f0b45a]/10"
                    : "border-white/[0.1] bg-white/[0.03] hover:border-white/20"
                )}
              >
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#f0b45a]">
                  {f.kicker}
                </p>
                <p className="mt-1 text-[13px] font-medium leading-snug text-white">
                  {f.title}
                </p>
                <span
                  className="mt-3 block h-0.5 overflow-hidden rounded-full bg-white/10"
                  aria-hidden
                >
                  <motion.span
                    key={active ? `run-${step}` : "idle"}
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
      key={id}
      initial={reduce ? false : { opacity: 0, y: 22, rotateX: 18 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.7, ease: EASE }}
      style={{ transformPerspective: 1000, transformStyle: "preserve-3d" }}
      className="w-full max-w-none shrink-0 sm:max-w-[18.5rem]"
    >
      <div className="mac-chassis p-1.5 sm:p-2">
        <div className="mac-bezel">
          <div className="mac-glass rounded-[15px] bg-[#0a121a]/95 p-4">
      {id === "google" ? (
        <>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[#f0b45a]">
            Create account
          </p>
          <p className="font-display mt-1 text-xl text-white">Start your Dawn</p>
          <div className="mt-4 flex flex-col gap-2">
            <span className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-[13px] font-semibold text-[#1f1f1f]">
              <IconGoogle size={16} />
              Sign up with Google
            </span>
            <span className="inline-flex items-center justify-center rounded-full bg-[#5865f2] px-4 py-2.5 text-[13px] font-medium text-white">
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
          <p className="mt-2 font-mono text-[1.65rem] tracking-[0.18em] text-[#f0b45a]">
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
          <p className="text-[10px] uppercase tracking-[0.16em] text-[#f0b45a]">
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
                <span className="flex-1 text-[13px] text-white">{row.name}</span>
                <span className="font-mono text-[11px] text-[#f0b45a]">
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
          <p className="font-display mt-2 text-[2rem] tabular-nums leading-none text-white">
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
