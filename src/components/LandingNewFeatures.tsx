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
    id: "week",
    kicker: "Today",
    title: "A week on Today",
    body: "Mini consistency graph at the bottom of Today. Seven days. Same green scale as Stats.",
  },
  {
    id: "missions",
    kicker: "Missions",
    title: "Named runs with steps",
    body: "Hackathons, 7-day challenges, ongoing work. Steps check off like tasks. Days left on Today.",
  },
  {
    id: "care",
    kicker: "Study care",
    title: "Water. Eyes. Custom.",
    body: "Interval pings while you sit in the room — Discord and the browser, even if Dawn is closed.",
  },
  {
    id: "progress",
    kicker: "Progress",
    title: "Pick a day. See the cycle.",
    body: "Wake, habits, tasks, and a 24-hour study cycle. Tap a day on Stats and open its ratios.",
  },
] as const;

const ALSO_NOW = [
  "Dark / light on the landing",
  "Push while Dawn is in the background",
  "Night close from the sleep habit",
  "Day picker on Progress",
  "Morning board pings you can turn off",
  "Share Today, tasks, and study as PNG",
];

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
      className="scroll-mt-16 border-t border-[var(--lp-line)] px-4 py-14 sm:px-10 sm:py-24"
    >
      <div className="mx-auto max-w-5xl">
        <div className="max-w-xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--lp-gold)]">
            Now · Beta
          </p>
          <h2 className="font-display mt-2 text-[1.65rem] leading-tight text-[var(--lp-fg)] sm:text-[2.35rem]">
            What this version ships
          </h2>
          <p className="mt-3 max-w-[44ch] text-[15px] text-[var(--lp-muted)]">
            Google, friends, a week graph on Today, missions with steps, study
            care pings, and Progress you can actually inspect.
          </p>
        </div>

        <motion.div
          className="relative mt-8 overflow-hidden rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-card)]"
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
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--lp-gold)]">
                {feature.kicker}
              </p>
              <h3 className="font-display mt-2 text-[1.45rem] leading-tight text-[var(--lp-fg)] sm:text-[2.1rem]">
                {feature.title}
              </h3>
              <p className="mt-3 max-w-[32ch] text-[15px] leading-relaxed text-[var(--lp-muted)]">
                {feature.body}
              </p>
              <Link href="/signup" className="dawn-btn mt-6">
                Open Dawn
              </Link>
            </div>
            <FeatureOverlay id={feature.id} reduce={Boolean(reduce)} />
          </div>
        </motion.div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
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
                    ? "border-[var(--lp-gold)]/50 bg-[var(--lp-gold)]/10"
                    : "border-[var(--lp-border)] bg-[var(--lp-inset)] hover:border-[var(--lp-gold)]/30"
                )}
              >
                <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--lp-gold)]">
                  {f.kicker}
                </p>
                <p className="mt-1 text-[13px] font-medium leading-snug text-[var(--lp-fg)]">
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

        <ul className="mt-6 flex flex-wrap gap-2">
          {ALSO_NOW.map((item) => (
            <li
              key={item}
              className="rounded-full border border-[var(--lp-border)] bg-[var(--lp-inset)] px-3 py-1.5 text-[12px] text-[var(--lp-muted)]"
            >
              {item}
            </li>
          ))}
        </ul>
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

      {id === "week" ? (
        <>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[#f0b45a]">
            This week
          </p>
          <p className="font-display mt-1 text-xl text-white">6 consistent days</p>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => {
              const level = [0, 2, 1, 3, 4, 2, 2][i];
              const fill =
                level === 0
                  ? "bg-white/10"
                  : level === 1
                    ? "bg-[#0e4429]"
                    : level === 2
                      ? "bg-[#006d32]"
                      : level === 3
                        ? "bg-[#26a641]"
                        : "bg-[#39d353]";
              return (
                <span key={`${d}-${i}`} className="min-w-0 text-center">
                  <span className="block text-[10px] text-[#8ba3b8]">{d}</span>
                  <span
                    className={`mx-auto mt-1 block h-6 w-6 rounded-md ${fill}`}
                  />
                </span>
              );
            })}
          </div>
          <p className="mt-3 text-[12px] text-[#8ba3b8]">
            Fri · 5/5 habits · 40m study
          </p>
        </>
      ) : null}

      {id === "missions" ? (
        <>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[#f0b45a]">
            Mission
          </p>
          <p className="font-display mt-1 text-xl text-white">Hackathon</p>
          <p className="mt-1 text-[12px] text-[#8ba3b8]">Day 3 · 4 left</p>
          <ul className="mt-4 space-y-2">
            {[
              { text: "Ship the landing", done: true },
              { text: "Wire the graph", done: true },
              { text: "Record a demo", done: false },
            ].map((s) => (
              <li key={s.text} className="flex items-center gap-2 text-[13px]">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border text-[9px] ${
                    s.done
                      ? "border-[#6fbf8a] bg-[#6fbf8a] text-[#0a0e12]"
                      : "border-white/25"
                  }`}
                >
                  {s.done ? "✓" : ""}
                </span>
                <span className={s.done ? "text-[#8ba3b8] line-through" : "text-white"}>
                  {s.text}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {id === "care" ? (
        <>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[#6fbf8a]">
            Study · live
          </p>
          <p className="font-display mt-1 text-xl text-white">1h 42m</p>
          <div className="mt-4 space-y-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <p className="text-[11px] text-[#f0b45a]">Water</p>
              <p className="text-[13px] text-white">Drink. Next in 18m.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <p className="text-[11px] text-[#8ba3b8]">Eyes</p>
              <p className="text-[13px] text-white">Look away. Every 20m.</p>
            </div>
          </div>
        </>
      ) : null}

      {id === "progress" ? (
        <>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[#f0b45a]">
            Stats
          </p>
          <p className="font-display mt-1 text-xl text-white">Sat, Sep 6</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              ["Wake", "05:52"],
              ["Habits", "80%"],
              ["Study", "1h 12m"],
            ].map(([k, v]) => (
              <div
                key={k}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2"
              >
                <p className="text-[10px] uppercase tracking-[0.12em] text-[#8ba3b8]">
                  {k}
                </p>
                <p className="font-display mt-0.5 text-sm text-[#f0b45a]">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex h-10 items-end gap-0.5">
            {[20, 45, 10, 70, 90, 35, 55, 80, 40, 65, 25, 50].map((h, i) => (
              <span
                key={i}
                className="flex-1 rounded-sm bg-[#f0b45a]/80"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[#8ba3b8]">24-hour study cycle</p>
        </>
      ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
