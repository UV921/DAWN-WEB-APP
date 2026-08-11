"use client";

import { useEffect, useRef, useState } from "react";
import { formatDuration } from "@/lib/habit-windows";
import { FlowSteps, IconChevronRight, IconSettings } from "@/components/icons";

type Props = {
  pledge?: string;
  whyLine?: string;
  challengeDay?: number;
  challengeTotal?: number;
  planGoal?: string;
  planWake?: string;
  disabled?: boolean;
  alreadyUp?: boolean;
  /** Only true inside the wake time window */
  windowOpen?: boolean;
  windowStart?: string;
  windowEnd?: string;
  opensInMin?: number;
  onRise: () => void | Promise<void>;
};

/** Hold-to-rise — only active during the morning wake window. */
export function MorningRitual({
  pledge,
  whyLine,
  challengeDay,
  challengeTotal = 7,
  planGoal,
  planWake,
  disabled,
  alreadyUp,
  windowOpen = false,
  windowStart,
  windowEnd,
  opensInMin,
  onRise,
}: Props) {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const raf = useRef<number | null>(null);
  const start = useRef(0);
  const HOLD_MS = 2200;
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      void wakeLock.current?.release();
    };
  }, []);

  async function requestWakeLock() {
    try {
      if ("wakeLock" in navigator) {
        wakeLock.current = await navigator.wakeLock.request("screen");
      }
    } catch {
      /* ignore */
    }
  }

  function releaseWakeLock() {
    void wakeLock.current?.release();
    wakeLock.current = null;
  }

  function tick(now: number) {
    const p = Math.min(1, (now - start.current) / HOLD_MS);
    setProgress(p);
    if (p >= 1) {
      setHolding(false);
      setDone(true);
      releaseWakeLock();
      void onRise();
      return;
    }
    raf.current = requestAnimationFrame(tick);
  }

  function beginHold() {
    if (disabled || alreadyUp || done || !windowOpen) return;
    setHolding(true);
    void requestWakeLock();
    start.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  }

  function endHold() {
    if (raf.current) cancelAnimationFrame(raf.current);
    setHolding(false);
    releaseWakeLock();
    if (progress < 1) setProgress(0);
  }

  if (alreadyUp || done) {
    return (
      <section className="rounded-2xl border border-[var(--color-dawn)]/35 bg-[var(--color-dawn)]/10 px-5 py-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-dawn)]">
          You’re up
        </p>
        <p className="font-display mt-2 text-3xl text-white">Morning started</p>
        <p className="mt-2 text-sm text-[var(--color-mist)]">
          Logged in your wake window. Finish open habits — don’t go back to bed.
        </p>
      </section>
    );
  }

  // Outside morning window — no hold button
  if (!windowOpen) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-mist)]">
          Not your wake window yet
        </p>
        <p className="font-display mt-2 text-2xl text-white sm:text-3xl">
          Are you awake?
        </p>
        <p className="mt-3 text-sm text-[var(--color-mist)]">
          Dawn only asks this around your morning time
          {windowStart && windowEnd ? (
            <>
              :{" "}
              <span className="font-mono text-[var(--color-dawn)]">
                {windowStart}–{windowEnd}
              </span>
            </>
          ) : null}
          . Change it in{" "}
          <a
            href="/settings?tab=morning"
            className="inline-flex items-center gap-1 text-white underline-offset-2 hover:underline"
          >
            <IconSettings size={14} />
            Settings
            <IconChevronRight size={14} />
            Morning
          </a>
          .
        </p>
        {typeof opensInMin === "number" && opensInMin > 0 ? (
          <p className="mt-2 text-sm text-[var(--color-leaf)]">
            Opens in {formatDuration(opensInMin)}
          </p>
        ) : (
          <p className="mt-2 text-sm text-[var(--color-mist)]">
            Come back around your ask time
            {planWake ? ` (${planWake})` : ""}.
          </p>
        )}
        <div className="mx-auto mt-6 flex h-28 w-28 items-center justify-center rounded-full border border-dashed border-white/20 opacity-50 sm:h-32 sm:w-32">
          <span className="text-xs text-[var(--color-mist)]">Locked</span>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--color-dawn)]/30 bg-gradient-to-b from-[var(--color-dawn)]/15 to-transparent px-5 py-7">
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-dawn)]">
        Morning · are you awake?
        {challengeDay ? ` · Day ${challengeDay}/${challengeTotal}` : ""}
        {windowStart && windowEnd ? ` · ${windowStart}–${windowEnd}` : ""}
      </p>
      <p className="font-display mt-3 text-3xl text-white md:text-4xl">
        Are you awake?
      </p>
      {pledge ? (
        <p className="mt-3 text-sm text-[var(--color-cloud)]">“{pledge}”</p>
      ) : null}
      {whyLine ? (
        <p className="mt-2 text-sm text-[var(--color-mist)]">{whyLine}</p>
      ) : null}
      {planGoal || planWake ? (
        <p className="mt-3 text-sm text-[var(--color-leaf)]">
          {planWake ? `Ask time ${planWake}` : ""}
          {planWake && planGoal ? " · " : ""}
          {planGoal ? planGoal : ""}
        </p>
      ) : null}
      <p className="mt-3 text-sm text-[var(--color-mist)]">
        <FlowSteps steps={["Hold yes", "Reminders", "Today’s tasks"]} />
      </p>

      <button
        type="button"
        disabled={disabled}
        onPointerDown={beginHold}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
        className="relative mx-auto mt-6 flex h-40 w-40 touch-none select-none items-center justify-center rounded-full border-2 border-[var(--color-dawn)] bg-black/30 text-center shadow-[0_0_40px_rgba(240,180,90,0.25)] disabled:opacity-50 sm:mt-8 sm:h-36 sm:w-36"
        style={{
          boxShadow: holding
            ? `0 0 ${24 + progress * 40}px rgba(240,180,90,${0.25 + progress * 0.45})`
            : undefined,
        }}
      >
        <svg
          className="absolute inset-0 h-full w-full -rotate-90"
          viewBox="0 0 100 100"
          aria-hidden
        >
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="4"
          />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="var(--color-dawn)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${progress * 289} 289`}
          />
        </svg>
        <span className="relative z-10 px-4 text-sm font-semibold text-white">
          {holding ? "Keep holding…" : "Yes — I’m awake"}
        </span>
      </button>
      <p className="mt-4 text-center text-xs text-[var(--color-mist)]">
        Only in your morning window. Locks wake time to now.
      </p>
    </section>
  );
}
