"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import Link from "next/link";
import { DawnMark } from "@/components/DawnMark";
import { LandingCharts } from "@/components/LandingCharts";
import { LandingDayClock } from "@/components/LandingDayClock";
import { LandingHeroBackdrop } from "@/components/LandingHeroBackdrop";
import { LandingHeroFilm } from "@/components/LandingHeroFilm";
import { LandingInstall } from "@/components/LandingInstall";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { LandingLifecycleFilm } from "@/components/LandingLifecycleFilm";
import { LandingNav } from "@/components/LandingNav";
import { LandingNewFeatures } from "@/components/LandingNewFeatures";
import { LandingPhilosophyFilm } from "@/components/LandingPhilosophyFilm";
import { LandingStudyFilm } from "@/components/LandingStudyFilm";
import { LandingNightDetail } from "@/components/LandingNightDetail";
import { defaultWindowForKey } from "@/lib/habit-windows";
import type { LandingSnapshot } from "@/lib/landing-data";
import { cn } from "@/lib/utils";

const WAKE = "06:00";
const SLEEP = "23:00";
const SLEEP_WIN = defaultWindowForKey("sleepEarly", WAKE, SLEEP);
const WAKE_WIN = defaultWindowForKey("wakeEarly", WAKE, SLEEP);

const EASE = [0.22, 1, 0.36, 1] as const;
const PANEL = "overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0d131a]";
const INSET = "rounded-xl border border-white/[0.1] bg-white/[0.03]";

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
];

const NAMED_LISTS = [
  {
    name: "Want to buy",
    items: [
      { text: "AirPods", done: false },
      { text: "Notebook", done: true },
      { text: "White tee", done: false },
    ],
  },
  {
    name: "Share on X",
    items: [
      { text: "Week card", done: false },
      { text: "Streak post", done: true },
    ],
  },
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
  const live = snap.people > 0 || snap.mornings > 0 || snap.tasksTotal > 0;
  const taskPct =
    snap.tasksTotal > 0
      ? Math.round((snap.tasksDone / snap.tasksTotal) * 100)
      : null;
  const last7 = snap.series.slice(-7);
  const habit7 =
    live && last7.length
      ? Math.round(last7.reduce((sum, d) => sum + d.habitPct, 0) / last7.length)
      : 72;
  const taskDoneShow = snap.tasksTotal ? snap.tasksDone : 8;
  const taskTotalShow = snap.tasksTotal ? snap.tasksTotal : 12;
  const taskFill = Math.round((taskDoneShow / Math.max(taskTotalShow, 1)) * 100);
  const streakShow = live ? Math.max(snap.wakesToday, 1) : 7;

  return (
    <main className="bg-[#0a0e12] text-[#e8e4dc]">
      <LandingNav />
      <LandingInstall />

      <section
        id="top"
        className="relative overflow-hidden pt-16"
      >
        <LandingHeroBackdrop />
        <div className="relative z-10">
          <ContainerScroll
            titleComponent={
              <>
                <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-[#f0b45a]">
                  Wake · Lists · Study · Night
                </p>
                <h1 className="font-display text-[clamp(3rem,8vw,5.25rem)] leading-[0.95] tracking-[-0.03em] text-white">
                  Dawn
                </h1>
                <p className="mx-auto mt-4 max-w-[28ch] text-[1.05rem] leading-snug text-[#9aa6b2] sm:text-lg">
                  One screen for the day. Wake, lists, study, then close the night.
                </p>
                <Link href="/signup" className="dawn-btn relative z-30 mt-8">
                  Open Dawn
                </Link>
              </>
            }
          >
            <LandingHeroFilm />
          </ContainerScroll>
        </div>
      </section>

      <LandingNewFeatures />

      {live ? (
        <section className="border-t border-white/[0.08] px-5 py-10 sm:px-10">
          <motion.div
            className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4"
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
              unit="wakes logged"
            />
          </motion.div>
        </section>
      ) : null}

      <section className="border-t border-white/[0.08] px-5 py-16 sm:px-10 sm:py-24">
        <div className="mx-auto grid min-w-0 max-w-5xl items-stretch gap-8 lg:grid-cols-2 lg:gap-10">
          <Fade className="flex flex-col justify-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#f0b45a]">
              The rule
            </p>
            <h2 className="font-display mt-3 text-[1.85rem] leading-tight text-white sm:text-[2.15rem]">
              Today is the loop.
            </h2>
            <p className="mt-4 max-w-[28ch] text-[15px] text-[#9aa6b2]">
              Wake in the window. Habits on a clock. Lists on Tasks.
            </p>
          </Fade>
          <motion.div
            className={cn(PANEL, "min-h-[24rem] overflow-hidden lg:min-h-[26rem]")}
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
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#f0b45a]">
                  The screen
                </p>
                <h2 className="font-display mt-2 text-[1.85rem] text-white sm:text-[2.15rem]">
                  Today
                </h2>
              </div>
            </div>
          </Fade>

          <LoopStrip reduce={Boolean(reduce)} />

          <div className="mt-10 grid min-w-0 items-stretch gap-6 lg:grid-cols-2">
            <Fade className="h-full">
              <div className={cn(PANEL, "flex h-full flex-col")}>
                <div className="relative overflow-hidden p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#f0b45a]">
                      Morning pulse
                    </p>
                    <p className="font-mono text-[11px] text-[#6fbf8a]">
                      On track
                    </p>
                  </div>
                  <p className="font-display mt-3 text-[1.65rem] leading-tight text-white">
                    You woke. Two tasks open.
                  </p>
                  <div className="mt-4">
                    <div className="flex justify-between text-[11px] text-[#8ba3b8]">
                      <span>{WAKE_WIN.start}–{WAKE_WIN.end}</span>
                      <span>05:52</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden bg-white/10">
                      <motion.div
                        className="h-full bg-[#f0b45a]"
                        initial={reduce ? { width: "62%" } : { width: "0%" }}
                        whileInView={{ width: "62%" }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mx-4 flex items-center gap-3 rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0b45a] text-[12px] font-semibold text-[#0a0e12]">
                    ✓
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] text-white">I’m awake</p>
                    <p className="text-[12px] text-[#8ba3b8]">05:52</p>
                  </div>
                  <p className="font-mono text-[12px] text-[#f0b45a]">+12</p>
                </div>

                <div className="grid flex-1 grid-cols-2 gap-3 p-4">
                  <MiniStat
                    label="Streak"
                    value="7"
                    hint="early wakes"
                    fill={70}
                  />
                  <MiniStat
                    label="Morning"
                    value="1/5"
                    hint="habits in window"
                    fill={20}
                  />
                  <MiniStat
                    label="Run"
                    value="3/7"
                    hint="4 days left"
                    fill={43}
                  />
                  <MiniStat
                    label="Reward"
                    value="Lv 4"
                    hint="240 XP · 40 to next"
                    fill={68}
                  />
                </div>
              </div>
            </Fade>

            <motion.div
              className={cn(PANEL, "flex h-full flex-col")}
              initial={reduce ? false : { opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, ease: EASE }}
            >
              <div className="border-b border-white/[0.08] px-5 py-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#f0b45a]">
                  Habits
                </p>
              </div>
              <ul className="flex-1 divide-y divide-white/[0.06]">
                {HABITS_TODAY.map((h, i) => (
                  <motion.li
                    key={h.label}
                    className={`flex items-center gap-3 px-5 py-3.5 ${
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
              <div className="border-t border-white/[0.08] px-5 py-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-display text-lg text-[#f0b45a]">Today</p>
                    <p className="text-[11px] text-[#8ba3b8]">
                      Check-off only · 2 of 3
                    </p>
                  </div>
                  <p className="text-[11px] font-medium text-[#f0b45a]">
                    Tasks
                  </p>
                </div>
                <ul>
                  {TASKS_TODAY.map((t) => (
                    <li
                      key={t.text}
                      className="flex items-center gap-3 border-t border-white/[0.06] py-2.5 first:border-t-0"
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                          t.done
                            ? "border-[#6fbf8a] bg-[#6fbf8a] text-[#0a0e12]"
                            : "border-white/25"
                        }`}
                      >
                        {t.done ? "✓" : ""}
                      </span>
                      <span
                        className={
                          t.done
                            ? "text-[13px] text-[#8ba3b8] line-through"
                            : "text-[13px] text-white"
                        }
                      >
                        {t.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section
        id="tasks"
        className="scroll-mt-16 border-t border-white/[0.08] px-5 py-16 sm:px-10 sm:py-24"
      >
        <div className="mx-auto grid min-w-0 max-w-5xl items-stretch gap-6 lg:grid-cols-2">
          <Fade className="flex h-full flex-col">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#f0b45a]">
              Inbox
            </p>
            <h2 className="font-display mt-2 text-[1.85rem] text-white sm:text-[2.15rem]">
              Named lists
            </h2>
            <div className={cn(PANEL, "mt-6 flex min-h-[20rem] flex-1 flex-col")}>
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] bg-[linear-gradient(160deg,rgba(240,180,90,0.12),transparent_72%)] px-5 py-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#f0b45a]">
                    Tasks
                  </p>
                  <p className="font-display mt-1 text-xl text-white">Today</p>
                </div>
                <span className="rounded-full border border-[#f0b45a]/40 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-[#f0b45a]">
                  Share PNG
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 px-5 pt-4">
                {["Today", "Buy", "Share on X", "Errands"].map((p, i) => (
                  <span
                    key={p}
                    className={`rounded-full px-3 py-1 text-[11px] ${
                      i === 1
                        ? "bg-[#f0b45a] font-semibold text-[#0a0e12]"
                        : "border border-white/12 text-[#8ba3b8]"
                    }`}
                  >
                    {p}
                  </span>
                ))}
              </div>
              <p className="mx-5 mt-3 border border-white/12 bg-white/[0.03] px-3 py-2.5 text-[13px] text-[#8ba3b8]">
                Add to Want to buy
              </p>
              <div className="flex flex-1 flex-col gap-3 p-5 pt-4">
                {NAMED_LISTS.map((list) => (
                  <div
                    key={list.name}
                    className="border border-white/10 bg-black/25"
                  >
                    <div className="flex items-baseline justify-between border-b border-white/[0.07] px-3 py-2">
                      <p className="font-display text-lg text-[#f0b45a]">
                        {list.name}
                      </p>
                      <p className="text-[11px] tabular-nums text-[#8ba3b8]">
                        {list.items.filter((x) => x.done).length} of{" "}
                        {list.items.length}
                      </p>
                    </div>
                    <ul>
                      {list.items.map((t) => (
                        <li
                          key={t.text}
                          className="flex items-center gap-3 border-t border-white/[0.06] px-3 py-2.5 first:border-t-0"
                        >
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                              t.done
                                ? "border-[#6fbf8a] bg-[#6fbf8a] text-[#0a0e12]"
                                : "border-[#f0b45a]/50"
                            }`}
                          >
                            {t.done ? "✓" : ""}
                          </span>
                          <span
                            className={
                              t.done
                                ? "text-[13px] text-[#8ba3b8] line-through"
                                : "text-[13px] text-white"
                            }
                          >
                            {t.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </Fade>
          <Fade delay={0.12} className="flex h-full flex-col">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#f0b45a]">
              Close
            </p>
            <h2 className="font-display mt-2 text-[1.85rem] text-white sm:text-[2.15rem]">
              Night
            </h2>
            <p className="mt-2 max-w-[36ch] text-[14px] leading-relaxed text-[#9aa6b2]">
              What time you slept. What time you should have. A gold band for
              the plan — bars for the nights you actually took.
            </p>
            <div className="mt-6 flex min-h-[20rem] flex-1">
              <LandingNightDetail sleepGoal={SLEEP} wakeGoal={WAKE} />
            </div>
          </Fade>
        </div>
      </section>

      <section className="border-t border-white/[0.08] px-5 py-16 sm:px-10 sm:py-24">
        <div className="mx-auto grid min-w-0 max-w-5xl items-stretch gap-8 lg:grid-cols-2 lg:gap-10">
          <Fade className="flex flex-col justify-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#f0b45a]">
              New loop
            </p>
            <h2 className="font-display mt-3 text-[1.85rem] leading-tight text-white sm:text-[2.15rem]">
              List. Study. Share.
            </h2>
          </Fade>
          <motion.div
            className={cn(PANEL, "min-h-[24rem] overflow-hidden")}
            initial={reduce ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <LandingLifecycleFilm />
          </motion.div>
        </div>
      </section>

      <section
        id="stats"
        className="scroll-mt-16 border-t border-white/[0.08] px-5 py-16 sm:px-10 sm:py-24"
      >
        <div className="mx-auto max-w-5xl">
          <Fade>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#f0b45a]">
              Progress
            </p>
            <h2 className="font-display mt-2 text-[1.85rem] text-white sm:text-[2.15rem]">
              Stats
            </h2>
          </Fade>

          <div className="mt-8 grid gap-3 sm:grid-cols-4">
            <StatPulse
              label="Habits · 7d"
              hint="full mornings"
              delay={0}
              fill={habit7}
              countTo={habit7}
              format={(n) => `${n}%`}
            />
            <StatPulse
              label="Study · week"
              hint="marked VCs"
              delay={0.08}
              fill={62}
              countTo={370}
              format={(n) => `${Math.floor(n / 60)}h ${n % 60}m`}
            />
            <StatPulse
              label="Tasks closed"
              hint="this week"
              delay={0.16}
              fill={taskFill}
              countTo={taskDoneShow}
              format={(n) => `${n}/${taskTotalShow}`}
            />
            <StatPulse
              label={live ? "Woke today" : "Early streak"}
              hint="on-time wakes"
              delay={0.24}
              fill={Math.min(100, streakShow * 12)}
              countTo={streakShow}
              format={(n) => `${n}`}
            />
          </div>

          <motion.div
            className={cn(PANEL, "mt-6 overflow-hidden p-5 sm:p-7")}
            initial={reduce ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.75, ease: EASE }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#f0b45a]">
                14 days
              </p>
              <div className="flex gap-4 text-[11px] text-[#8ba3b8]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-[#f0b45a]" /> Habits
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-[#6fbf8a]" /> Tasks
                </span>
              </div>
            </div>
            <LandingCharts series={snap.series} />
          </motion.div>
        </div>
      </section>

      <section
        id="study"
        className="scroll-mt-16 border-t border-white/[0.08] px-5 py-16 sm:px-10 sm:py-24"
      >
        <div className="mx-auto grid min-w-0 max-w-5xl items-stretch gap-8 lg:grid-cols-2 lg:gap-10">
          <Fade className="flex flex-col justify-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#f0b45a]">
              Discord
            </p>
            <h2 className="font-display mt-2 text-[1.85rem] text-white sm:text-[2.15rem]">
              Sit in the room
            </h2>
            <p className="mt-4 max-w-[28ch] text-[15px] text-[#9aa6b2]">
              Mark a voice channel. Hours count while you’re in it.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <code className="max-w-full rounded-full border border-[#5865F2]/40 bg-[#5865F2]/10 px-3 py-1.5 text-[12px] text-[#8ba9ff]">
                /study-room add
              </code>
              <code className="rounded-full border border-[#f0b45a]/35 bg-[#f0b45a]/10 px-3 py-1.5 text-[12px] text-[#f0b45a]">
                /studied
              </code>
            </div>
          </Fade>
          <motion.div
            className={cn(PANEL, "min-h-[22rem] min-w-0 overflow-hidden")}
            initial={reduce ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <LandingStudyFilm />
          </motion.div>
        </div>
      </section>

      <section
        id="clock"
        className="scroll-mt-16 border-t border-white/[0.08] px-5 py-16 sm:px-10 sm:py-24"
      >
        <div className="mx-auto max-w-5xl">
          <Fade>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#f0b45a]">
              Why Dawn
            </p>
            <h2 className="font-display mt-2 text-[1.85rem] text-white sm:text-[2.15rem]">
              One day. One loop.
            </h2>
            <p className="mt-3 max-w-[36ch] text-[15px] text-[#9aa6b2]">
              Not anytime. Wake, lists, study, night — in that order.
            </p>
          </Fade>
          <motion.div
            className={cn(PANEL, "mt-8 p-5 sm:p-8")}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.75, ease: EASE }}
          >
            <LandingDayClock
              wakeStart={WAKE_WIN.start}
              wakeEnd={WAKE_WIN.end}
              sleepStart={SLEEP_WIN.start}
              sleepEnd={SLEEP_WIN.end}
            />
          </motion.div>
        </div>
      </section>

      <section className="border-t border-white/[0.08] px-5 py-24 sm:px-10 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <Fade>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#f0b45a]">
              The loop
            </p>
            <h2 className="font-display mt-4 max-w-[14ch] text-[2.4rem] leading-[0.95] text-white sm:text-[3.4rem]">
              Start today.
            </h2>
            <p className="mt-5 max-w-[32ch] text-[15px] text-[#9aa6b2]">
              Wake in the window. Check the lists. Sit in study. Close the night.
            </p>
            <ol className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {LOOP.map((chip) => (
                <li
                  key={chip.label}
                  className={cn(INSET, "px-4 py-3")}
                >
                  <p className="text-[10px] uppercase tracking-[0.12em] text-[#8ba3b8]">
                    {chip.n}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {chip.label}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-[#8ba3b8]">
                    {chip.detail}
                  </p>
                </li>
              ))}
            </ol>
            <div className="mt-10">
              <Link href="/signup" className="dawn-btn">
                Open Dawn
              </Link>
            </div>
          </Fade>
        </div>
      </section>

      <footer className="border-t border-white/[0.08] px-5 py-6 sm:px-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 text-[13px] text-[#6b7785]">
          <span className="text-[#f0b45a]">
            <DawnMark size={22} />
          </span>
          <span>Wake · lists · study · night</span>
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
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

function MiniStat({
  label,
  value,
  hint,
  fill,
}: {
  label: string;
  value: string;
  hint: string;
  fill?: number;
}) {
  return (
    <div className={cn(INSET, "flex h-full flex-col justify-center p-4 text-left")}>
      <p className="text-[10px] uppercase tracking-[0.12em] text-[#8ba3b8]">
        {label}
      </p>
      <p className="font-display mt-1.5 text-[1.75rem] leading-none tabular-nums text-[#f0b45a]">
        {value}
      </p>
      <p className="mt-1.5 text-[11px] text-[#6b7785]">{hint}</p>
      {fill != null ? (
        <div className="mt-2 h-1.5 overflow-hidden bg-white/10">
          <div className="h-full bg-[#f0b45a]" style={{ width: `${fill}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function StatPulse({
  label,
  hint,
  delay = 0,
  fill,
  countTo,
  format,
}: {
  label: string;
  hint: string;
  delay?: number;
  fill: number;
  countTo: number;
  format: (n: number) => string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const n = useCountUp(countTo, Boolean(inView && !reduce), delay);

  return (
    <motion.div
      ref={ref}
      className={cn(INSET, "px-4 py-4")}
      initial={reduce ? false : { opacity: 0, y: 16, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#8ba3b8]">
        {label}
      </p>
      <p className="font-display mt-2 text-[1.85rem] leading-none tabular-nums text-[#f0b45a]">
        {format(n)}
      </p>
      <p className="mt-1.5 text-[11px] text-[#6b7785]">{hint}</p>
      <div className="mt-3 h-1 overflow-hidden bg-white/10">
        <motion.div
          className="h-full bg-gradient-to-r from-[#e07a3a] to-[#f0b45a]"
          initial={reduce ? { width: `${Math.min(100, fill)}%` } : { width: "0%" }}
          whileInView={{ width: `${Math.min(100, fill)}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: delay + 0.15, ease: EASE }}
        />
      </div>
    </motion.div>
  );
}

function useCountUp(target: number, enabled: boolean, delay: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setN(target);
      return;
    }
    setN(0);
    let raf = 0;
    const startAt = performance.now() + delay * 1000;
    const dur = 900;
    const tick = (now: number) => {
      if (now < startAt) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(1, (now - startAt) / dur);
      const eased = 1 - (1 - t) ** 3;
      setN(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled, delay]);
  return n;
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
      className={cn(
        INSET,
        "flex h-full min-h-[6.75rem] flex-col items-center justify-center px-3 py-4 text-center"
      )}
    >
      <p className="min-h-[2.4em] text-[10px] uppercase leading-tight tracking-[0.12em] text-[#8ba3b8]">
        {label}
      </p>
      <p className="font-display mt-1 text-2xl leading-none tabular-nums text-[#f0b45a]">
        {value}
      </p>
      <p className="mt-1.5 min-h-[2.2em] text-[11px] leading-tight text-[#6b7785]">
        {unit}
      </p>
    </motion.div>
  );
}

function LoopStrip({ reduce }: { reduce: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-40px" });
  const [loopStep, setLoopStep] = useState(0);

  useEffect(() => {
    if (reduce || !inView) return;
    const id = window.setInterval(() => {
      setLoopStep((n) => (n + 1) % LOOP.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, [reduce, inView]);

  return (
    <div ref={ref} className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      {LOOP.map((chip, i) => (
        <LoopChip
          key={chip.label}
          n={chip.n}
          label={chip.label}
          detail={chip.detail}
          lit={reduce ? i === 0 : loopStep === i}
        />
      ))}
    </div>
  );
}

function LoopChip({
  n,
  label,
  detail,
  lit,
}: {
  n: string;
  label: string;
  detail: string;
  lit?: boolean;
}) {
  const on = Boolean(lit);
  return (
    <motion.div
      animate={{
        backgroundColor: on ? "rgba(240,180,90,1)" : "rgba(255,255,255,0.03)",
        borderColor: on ? "rgba(240,180,90,1)" : "rgba(255,255,255,0.1)",
        color: on ? "#0a0e12" : "#e8e4dc",
      }}
      transition={{ duration: 0.45, ease: EASE }}
      className="flex h-full min-h-[4.25rem] min-w-0 flex-col justify-center rounded-xl border px-2.5 py-2 sm:min-h-[4.75rem] sm:px-3 sm:py-2.5"
    >
      <p
        className={`text-[10px] uppercase tracking-[0.12em] ${
          on ? "text-[#0a0e12]/70" : "text-[#8ba3b8]"
        }`}
      >
        {n}
      </p>
      <p className={`mt-1 truncate text-xs font-semibold ${on ? "" : "text-white"}`}>
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
