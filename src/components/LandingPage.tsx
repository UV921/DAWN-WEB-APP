"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { LandingCharts } from "@/components/LandingCharts";
import { LandingPhilosophyFilm } from "@/components/LandingPhilosophyFilm";
import { NightClosed } from "@/components/NightClosed";
import { defaultWindowForKey } from "@/lib/habit-windows";
import type { LandingSnapshot } from "@/lib/landing-data";

const WAKE = "06:00";
const SLEEP = "23:00";
const SLEEP_WIN = defaultWindowForKey("sleepEarly", WAKE, SLEEP);
const WAKE_WIN = defaultWindowForKey("wakeEarly", WAKE, SLEEP);

const EASE = [0.22, 1, 0.36, 1] as const;

const COMMANDS = [
  { cmd: "/woke", detail: "Log wake · only counts inside your wake window" },
  { cmd: "/checkin", detail: "Mark habits done while their window is open" },
  { cmd: "/today", detail: "Morning card — wake, habits, streak, XP" },
  { cmd: "/todo add", detail: "Dump a task for today (shows on Today to check off)" },
  { cmd: "/todo list", detail: "Today’s tasks — toggle done in Discord" },
  { cmd: "/todo tomorrow", detail: "Set tomorrow — only in your sleep window" },
  { cmd: "/plan", detail: "Write tomorrow’s wake + one sentence, then sleep" },
  { cmd: "/sleep", detail: "Log bedtime in the sleep window" },
  { cmd: "/streak", detail: "Early wake + perfect-day streaks" },
  { cmd: "/week", detail: "Last 7 days as bars" },
  { cmd: "/grid", detail: "Year heatmap of showing up" },
  { cmd: "/track", detail: "Turn a channel into the morning board" },
  { cmd: "/join", detail: "Join so /ping reaches you" },
  { cmd: "/leaderboard", detail: "Who woke · habit ranks for the room" },
];

const HABITS_TODAY = [
  { label: "Wake early", meta: "Done · 05:52", done: true },
  { label: "No phone", meta: "Open · until 08:00", done: false },
  { label: "Gym", meta: "Opens in 1h 12m", done: false, locked: true },
  { label: "Reading", meta: "Opens later today", done: false, locked: true },
  {
    label: "Sleep early",
    meta: `Opens ${SLEEP_WIN.start}–${SLEEP_WIN.end}`,
    done: false,
    locked: true,
  },
];

const TASKS_TODAY = [
  { text: "Send the brief", done: true },
  { text: "Gym bag in the hall", done: true },
  { text: "Call back before 11", done: false },
  { text: "Read 10 pages", done: false },
];

const LOOP = [
  { n: "1", label: "Wake", detail: "05:52" },
  { n: "2", label: "Habits", detail: "1/5" },
  { n: "3", label: "Tasks", detail: "2/4" },
  { n: "4", label: "Night", detail: SLEEP },
];

type Props = { snap: LandingSnapshot };

export function LandingPage({ snap }: Props) {
  const reduce = useReducedMotion();
  const [loopStep, setLoopStep] = useState(0);
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const live = snap.people > 0 || snap.mornings > 0 || snap.tasksTotal > 0;
  const taskPct =
    snap.tasksTotal > 0
      ? Math.round((snap.tasksDone / snap.tasksTotal) * 100)
      : null;

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setLoopStep((n) => (n + 1) % LOOP.length);
    }, 1600);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <main className="bg-[#0a0e12] text-[#e8e4dc]">
      <section className="relative min-h-[100dvh] overflow-hidden">
        <motion.div
          className="absolute inset-0"
          initial={reduce ? false : { scale: 1.08, opacity: 0.65 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: reduce ? 0 : 1.8, ease: EASE }}
        >
          <motion.div
            className="absolute inset-0"
            animate={
              reduce
                ? undefined
                : { scale: [1, 1.06], x: ["0%", "-1.2%"], y: ["0%", "1%"] }
            }
            transition={
              reduce
                ? undefined
                : { duration: 28, ease: "linear", repeat: Infinity, repeatType: "reverse" }
            }
          >
            <Image
              src="/images/landing-dawn.jpg"
              alt="Quiet field at first light"
              fill
              priority
              sizes="100vw"
              className="object-cover object-[center_60%]"
            />
          </motion.div>
        </motion.div>
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[#0a0e12] via-[#0a0e12]/55 to-[#0a0e12]/25"
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#f0b45a]/15 to-transparent"
          animate={reduce ? undefined : { opacity: [0.35, 0.7, 0.35] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative z-10 flex min-h-[100dvh] flex-col">
          <motion.header
            className="flex items-center justify-between px-5 pt-6 sm:px-10 sm:pt-8"
            initial={reduce ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <p className="font-display text-[1.35rem] tracking-tight text-[#f0b45a]">
              Dawn
            </p>
            <Link
              href="/login"
              className="text-[13px] text-[#e8e4dc]/85 transition hover:text-white"
            >
              Sign in
            </Link>
          </motion.header>

          <div className="mt-auto px-5 pb-14 sm:px-10 sm:pb-16 md:pb-20">
            <motion.p
              className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-[#f0b45a]"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
            >
              Wake · Habits · Tasks · Night
            </motion.p>
            <motion.h1
              className="font-display max-w-[12ch] text-[clamp(3.25rem,11vw,6.5rem)] leading-[0.95] tracking-[-0.03em] text-white"
              initial={reduce ? false : { opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 0.28, ease: EASE }}
            >
              Dawn
            </motion.h1>
            <motion.p
              className="mt-4 max-w-[36ch] text-[1.05rem] leading-snug text-[#e8e4dc]/90 sm:text-lg"
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.42, ease: EASE }}
            >
              One loop. Add work in Tasks. Check it off on Today. Set tomorrow
              only in your sleep window. Stats graph the honest days.
            </motion.p>
            <motion.div
              className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3"
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.56, ease: EASE }}
            >
              <Link
                href="/login"
                className="landing-cta inline-flex h-11 items-center bg-[#f0b45a] px-6 text-[13px] font-semibold tracking-wide text-[#0a0e12] transition hover:bg-[#f5c56e]"
              >
                Open Dawn
              </Link>
              <Link
                href="/login"
                className="text-[13px] text-[#e8e4dc]/70 underline decoration-[#e8e4dc]/25 underline-offset-[5px] transition hover:text-white hover:decoration-white/50"
              >
                Demo login
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {live ? (
        <section className="border-t border-white/[0.08] px-5 py-10 sm:px-10">
          <motion.div
            className="mx-auto grid max-w-5xl grid-cols-2 gap-2 sm:grid-cols-4"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
          >
            <StatBox label="People in" value={`${snap.people}`} unit="onboarded" />
            <StatBox
              label="Mornings logged"
              value={`${snap.mornings}`}
              unit="last 14 days"
            />
            <StatBox
              label="Tasks closed"
              value={
                snap.tasksTotal ? `${snap.tasksDone}/${snap.tasksTotal}` : "—"
              }
              unit={taskPct != null ? `${taskPct}% done` : "last 14 days"}
            />
            <StatBox
              label="Up today"
              value={`${snap.wakesToday}`}
              unit="wake times logged"
            />
          </motion.div>
          <p className="mx-auto mt-4 max-w-5xl text-[12px] text-[#6b7785]">
            Live from Dawn — not a mock. Names stay off this page.
          </p>
        </section>
      ) : null}

      <section className="border-t border-white/[0.08] px-5 py-16 sm:px-10 sm:py-24">
        <div className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Fade>
            <h2 className="font-display text-[1.85rem] leading-tight text-white sm:text-[2.25rem]">
              Today is the loop. Tasks is the inbox.
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-[#9aa6b2]">
              Wake only counts inside your window ({WAKE_WIN.start}–{WAKE_WIN.end}{" "}
              if you wake at {WAKE}). Habits unlock on a clock — you can’t pad a
              streak at midnight. Work lives on the Tasks tab. Today only lists
              those tasks so you can check them off.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-[#9aa6b2]">
              Set tomorrow opens in your sleep window ({SLEEP_WIN.start}–
              {SLEEP_WIN.end} around a {SLEEP} bedtime). After{" "}
              <span className="text-white">Save & going to sleep</span>, the form
              hides and Dawn says sleep well.
            </p>
          </Fade>
          <motion.div
            className="relative overflow-hidden bg-[#121820]"
            initial={reduce ? false : { opacity: 0, scale: 1.06, y: 24 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            <LandingPhilosophyFilm
              wake={WAKE}
              sleep={SLEEP}
              wakeWin={WAKE_WIN}
              sleepWin={SLEEP_WIN}
            />
          </motion.div>
        </div>
      </section>

      <section className="border-t border-white/[0.08] px-5 py-16 sm:px-10 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <Fade>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-[1.85rem] text-white sm:text-[2.15rem]">
                  Today
                </h2>
                <p className="mt-2 max-w-md text-[15px] text-[#9aa6b2]">
                  {todayLabel} · wake goal {WAKE} · loop pays XP when you finish.
                </p>
              </div>
              <p className="font-mono text-[12px] text-[#6b7785]">
                How the screen is built
              </p>
            </div>
          </Fade>

          <div className="mt-8 grid grid-cols-4 gap-1.5">
            {LOOP.map((chip, i) => (
              <LoopChip
                key={chip.label}
                n={chip.n}
                label={chip.label}
                detail={chip.detail}
                done={i === 0}
                lit={reduce ? i === 0 : loopStep === i}
              />
            ))}
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.05fr] lg:items-start">
            <Fade>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <StatBox label="Early streak" value="7" unit="days" />
                  <StatBox label="Habits" value="1/5" unit="in window" />
                  <StatBox label="XP" value="+18" unit="clear tasks" />
                </div>
                <div className="border border-white/[0.1] bg-white/[0.03] p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8ba3b8]">
                    Morning pulse
                  </p>
                  <p className="mt-2 text-[15px] text-white">
                    You woke. Two tasks still open. Don’t stall the morning.
                  </p>
                  <p className="mt-2 text-[13px] text-[#8ba3b8]">
                    Next: no-phone while the window is open, then gym when it
                    unlocks.
                  </p>
                </div>
                <p className="text-[14px] leading-relaxed text-[#9aa6b2]">
                  Rewards that are real: wake in-window, +18 XP for clearing
                  Tasks, +22 closing night, +40 if the whole loop finishes.
                </p>
              </div>
            </Fade>

            <motion.div
              className="border border-white/[0.1] bg-[#0d131a]"
              initial={reduce ? false : { opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, ease: EASE }}
            >
              <div className="border-b border-white/[0.08] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#f0b45a]">
                  Morning habits
                </p>
                <p className="mt-1 text-[13px] text-[#8ba3b8]">
                  Up at 05:52 · window {WAKE_WIN.start}–{WAKE_WIN.end}
                </p>
              </div>
              <ul className="divide-y divide-white/[0.06]">
                {HABITS_TODAY.map((h, i) => (
                  <motion.li
                    key={h.label}
                    className={`flex items-center gap-3 px-4 py-3.5 ${
                      h.locked ? "opacity-50" : ""
                    }`}
                    initial={reduce ? false : { opacity: 0, x: 12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08, duration: 0.45, ease: EASE }}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                        h.done
                          ? "border-[#f0b45a] bg-[#f0b45a] text-[#0a0e12]"
                          : "border-white/25 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] text-white">
                        {h.label}
                      </span>
                      <span className="block text-[12px] text-[#8ba3b8]">
                        {h.meta}
                      </span>
                    </span>
                  </motion.li>
                ))}
              </ul>
              <div className="border-t border-white/[0.08] px-4 py-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="text-[13px] text-white">Today’s tasks</p>
                  <p className="text-[11px] text-[#f0b45a]">Add in Tasks</p>
                </div>
                <ul className="space-y-1.5">
                  {TASKS_TODAY.map((t) => (
                    <li
                      key={t.text}
                      className="flex items-center gap-2 text-[13px]"
                    >
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded border text-[9px] ${
                          t.done
                            ? "border-[#6fbf8a] bg-[#6fbf8a] text-[#0a0e12]"
                            : "border-white/25"
                        }`}
                      >
                        ✓
                      </span>
                      <span
                        className={
                          t.done ? "text-[#8ba3b8] line-through" : "text-white"
                        }
                      >
                        {t.text}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-[#6b7785]">
                  No add box here. Adding is Tasks-only.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.08] px-5 py-16 sm:px-10 sm:py-24">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2">
          <Fade>
            <h2 className="font-display text-[1.85rem] text-white sm:text-[2.15rem]">
              Tasks
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[#9aa6b2]">
              Dump work, calls, errands. Today’s list is always here. Tomorrow’s
              list only opens in the sleep window — not all day.
            </p>
            <div className="mt-6 border border-white/[0.1] bg-[#0d131a] p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#f0b45a]">
                Today · add
              </p>
              <p className="mt-3 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-[13px] text-[#8ba3b8]">
                Add a task — then Enter
              </p>
              <ul className="mt-3 space-y-2 text-[13px] text-white">
                {TASKS_TODAY.map((t) => (
                  <li key={t.text}>· {t.text}</li>
                ))}
              </ul>
            </div>
          </Fade>
          <Fade delay={0.12}>
            <h2 className="font-display text-[1.85rem] text-white sm:text-[2.15rem]">
              Night
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[#9aa6b2]">
              Set tomorrow appears at {SLEEP_WIN.start}–{SLEEP_WIN.end}. After
              you save and go to sleep, the form is gone — Sleep well, wake{" "}
              {WAKE}.
            </p>
            <div className="mt-6">
              <NightClosed sleepGoal={SLEEP} wakeGoal={WAKE} />
            </div>
          </Fade>
        </div>
      </section>

      <section className="border-t border-white/[0.08] px-5 py-16 sm:px-10 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <Fade>
            <h2 className="font-display text-[1.85rem] text-white sm:text-[2.15rem]">
              Stats
            </h2>
            <p className="mt-2 max-w-xl text-[15px] text-[#9aa6b2]">
              Habits vs tasks, weekday more/less, day mix, sleep hours, per-habit
              hit rate. Last 14 days below
              {live ? " — live from Dawn." : "."}
            </p>
          </Fade>
          <motion.div
            className="mt-8 border border-white/[0.1] bg-[#0d131a] p-4"
            initial={reduce ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            {snap.series.some((d) => d.habitPct > 0 || d.taskPct) ? (
              <LandingCharts series={snap.series} />
            ) : (
              <p className="py-16 text-center text-[14px] text-[#8ba3b8]">
                Charts fill after the first week of check-ins.
              </p>
            )}
          </motion.div>
        </div>
      </section>

      <section className="border-t border-white/[0.08] px-5 py-16 sm:px-10 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
            <Fade>
              <h2 className="font-display text-[1.85rem] text-white sm:text-[2.15rem]">
                Discord
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-[#9aa6b2]">
                Optional. Invite the bot, run{" "}
                <code className="text-[#f0b45a]">/track</code>, everyone{" "}
                <code className="text-[#f0b45a]">/join</code>, then{" "}
                <code className="text-[#f0b45a]">/woke</code>. Tasks and plan
                sync with the web.
              </p>
              <div className="mt-8 border border-white/[0.1] bg-[#0d131a] p-4 font-mono text-[12px] leading-relaxed text-[#c5ced6]">
                <p className="text-[#5865F2]">#morning-board</p>
                <p className="mt-3 text-[#8ba3b8]">you — Today at 5:52 AM</p>
                <p className="mt-1">
                  <span className="text-[#f0b45a]">/woke</span>
                </p>
                <p className="mt-3 text-[#8ba3b8]">dawn BOT — Today at 5:52 AM</p>
                <p className="mt-1 text-white">
                  Logged wake <span className="text-[#6fbf8a]">05:52</span> ·
                  early streak <span className="text-[#6fbf8a]">7</span>
                </p>
                <p className="mt-1 text-[#8ba3b8]">
                  Next: /todo add · /plan · /sleep
                </p>
              </div>
            </Fade>

            <motion.div
              className="border border-white/[0.1]"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.65, ease: EASE }}
            >
              <div className="border-b border-white/[0.08] px-4 py-3 text-[12px] text-[#8ba3b8]">
                Slash commands the bot registers
              </div>
              <ul className="max-h-[28rem] divide-y divide-white/[0.06] overflow-y-auto">
                {COMMANDS.map((c) => (
                  <li
                    key={c.cmd}
                    className="grid gap-1 px-4 py-3 sm:grid-cols-[9.5rem_1fr] sm:gap-4"
                  >
                    <code className="text-[13px] text-[#f0b45a]">{c.cmd}</code>
                    <span className="text-[13px] text-[#9aa6b2]">{c.detail}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.08] px-5 py-16 sm:px-10 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <Fade>
            <h2 className="font-display text-[1.85rem] text-white sm:text-[2.15rem]">
              The day
            </h2>
          </Fade>
          <div className="mt-10 divide-y divide-white/[0.08] border-y border-white/[0.08]">
            <LoopRow
              when={`${WAKE_WIN.start}–${WAKE_WIN.end}`}
              title="Wake window"
              body="Hold I’m awake, or /woke. Outside the window it doesn’t count."
            />
            <LoopRow
              when="Tasks tab"
              title="Dump the list"
              body="Add work there. Today only shows the list to check off — no add box."
            />
            <LoopRow
              when="On a clock"
              title="Habits unlock"
              body="Gym, reading, no-phone, sleep — each has a window. Locked rows say when they open."
            />
            <LoopRow
              when={`${SLEEP_WIN.start}–${SLEEP_WIN.end}`}
              title="Set tomorrow, then sleep"
              body="Only in the sleep window. Save & going to sleep hides the form and shows Sleep well."
            />
            <LoopRow
              when="Stats"
              title="Habits vs tasks"
              body="Completion %, weekday more/less, sleep hours, per-habit hit rate — from your log, not guesses."
            />
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.08] px-5 py-20 sm:px-10 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <Fade>
            <h2 className="font-display text-[2.25rem] text-white sm:text-[3rem]">
              Open it before your alarm wins.
            </h2>
            <p className="mt-3 max-w-md text-[15px] text-[#9aa6b2]">
              Demo login works in seconds. Discord login unlocks the friend board
              and slash commands.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href="/login"
                className="landing-cta inline-flex h-11 items-center bg-[#f0b45a] px-6 text-[13px] font-semibold tracking-wide text-[#0a0e12] transition hover:bg-[#f5c56e]"
              >
                Open Dawn
              </Link>
              <span className="font-mono text-[12px] text-[#6b7785]">
                Today · Tasks · Night · Stats
              </span>
            </div>
          </Fade>
        </div>
      </section>

      <footer className="border-t border-white/[0.08] px-5 py-6 sm:px-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 text-[13px] text-[#6b7785]">
          <span className="font-display text-[#f0b45a]">Dawn</span>
          <span>Wake · habits · tasks · night</span>
        </div>
      </footer>
    </main>
  );
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

function Fade({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

function StatBox({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <motion.div
      variants={item}
      className="border border-white/[0.1] bg-white/[0.03] px-3 py-3 text-center"
    >
      <p className="text-[10px] uppercase tracking-[0.12em] text-[#8ba3b8]">
        {label}
      </p>
      <p className="font-display mt-1.5 text-2xl text-[#f0b45a]">{value}</p>
      <p className="text-[11px] text-[#6b7785]">{unit}</p>
    </motion.div>
  );
}

function LoopChip({
  n,
  label,
  detail,
  done,
  lit,
}: {
  n: string;
  label: string;
  detail: string;
  done?: boolean;
  lit?: boolean;
}) {
  const on = Boolean(lit || done);
  return (
    <motion.div
      animate={{
        backgroundColor: on ? "rgba(240,180,90,1)" : "rgba(255,255,255,0.03)",
        borderColor: on ? "rgba(240,180,90,1)" : "rgba(255,255,255,0.12)",
        color: on ? "#0a0e12" : "#e8e4dc",
        scale: on ? 1.03 : 1,
      }}
      transition={{ duration: 0.45, ease: EASE }}
      className="rounded-xl border px-2 py-2.5"
    >
      <p
        className={`text-[10px] uppercase tracking-[0.12em] ${
          on ? "text-[#0a0e12]/70" : "text-[#8ba3b8]"
        }`}
      >
        {n}
      </p>
      <p className={`mt-1 text-xs font-semibold ${on ? "" : "text-white"}`}>
        {label}
      </p>
      <p
        className={`mt-0.5 text-[10px] ${
          on ? "text-[#0a0e12]/70" : "text-[#8ba3b8]"
        }`}
      >
        {detail}
      </p>
    </motion.div>
  );
}

function LoopRow({
  when,
  title,
  body,
}: {
  when: string;
  title: string;
  body: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="grid gap-2 py-7 sm:grid-cols-[9.5rem_1fr] sm:gap-10"
      initial={reduce ? false : { opacity: 0, x: -18 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, ease: EASE }}
    >
      <p className="font-mono text-[12px] text-[#f0b45a]">{when}</p>
      <div>
        <p className="text-[15px] text-white">{title}</p>
        <p className="mt-1 text-[14px] leading-relaxed text-[#9aa6b2]">{body}</p>
      </div>
    </motion.div>
  );
}
