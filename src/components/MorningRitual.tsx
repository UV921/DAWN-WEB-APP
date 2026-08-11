"use client";

import { useEffect, useRef, useState } from "react";
import { formatDuration } from "@/lib/habit-windows";

type Props = {
  pledge?: string;
  whyLine?: string;
  challengeDay?: number;
  challengeTotal?: number;
  planGoal?: string;
  planWake?: string;
  disabled?: boolean;
  alreadyUp?: boolean;
  windowOpen?: boolean;
  windowStart?: string;
  windowEnd?: string;
  opensInMin?: number;
  onRise: () => void | Promise<void>;
};

/** Hold-to-rise — compact; parent owns the section title. */
export function MorningRitual({
  pledge,
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
      <p className="text-center text-sm text-[var(--color-leaf)]">
        You’re up — morning started.
      </p>
    );
  }

  if (!windowOpen) {
    return (
      <div className="space-y-2 text-center">
        {typeof opensInMin === "number" && opensInMin > 0 ? (
          <p className="text-sm text-[var(--color-leaf)]">
            Opens in {formatDuration(opensInMin)}
          </p>
        ) : (
          <p className="text-sm text-[var(--color-mist)]">
            Window {windowStart && windowEnd ? `${windowStart}–${windowEnd}` : "closed"}
          </p>
        )}
        <a href="/settings?tab=morning" className="ui-btn-text text-sm">
          Change wake time
        </a>
      </div>
    );
  }

  return (
    <div className="text-center">
      {pledge ? (
        <p className="font-display mx-auto max-w-md text-lg text-white sm:text-xl">
          “{pledge}”
        </p>
      ) : planWake ? (
        <p className="text-sm text-[var(--color-mist)]">Goal · up by {planWake}</p>
      ) : null}

      <button
        type="button"
        disabled={disabled}
        onPointerDown={beginHold}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
        className="relative mx-auto mt-5 flex h-32 w-32 touch-none select-none items-center justify-center rounded-full border border-[var(--color-dawn)]/80 bg-[var(--color-dawn)]/10 text-center disabled:opacity-50 sm:h-36 sm:w-36"
        style={{
          boxShadow: holding
            ? `0 0 ${20 + progress * 36}px rgba(240,180,90,${0.2 + progress * 0.4})`
            : "0 0 24px rgba(240,180,90,0.12)",
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
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="3"
          />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="var(--color-dawn)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${progress * 289} 289`}
          />
        </svg>
        <span className="relative z-10 px-4 text-sm font-semibold text-white">
          {holding ? "Keep holding…" : "I’m awake"}
        </span>
      </button>
      <p className="mt-3 text-xs text-[var(--color-mist)]">
        Hold ~2s
        {windowStart && windowEnd ? ` · ${windowStart}–${windowEnd}` : ""}
      </p>
    </div>
  );
}
