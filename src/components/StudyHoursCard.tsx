"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GraduationCapIcon } from "@/components/ui/graduation-cap";
import type { GraduationCapIconHandle } from "@/components/ui/graduation-cap";
import {
  type StudyStats,
} from "@/components/StudyStatusPanel";

export function StudyHoursCard() {
  const [data, setData] = useState<StudyStats | null>(null);
  const iconRef = useRef<GraduationCapIconHandle>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/study", { cache: "no-store" });
      if (!res.ok) return;
      setData((await res.json()) as StudyStats);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 15_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  const live = Boolean(data?.today.live);
  useEffect(() => {
    iconRef.current?.startAnimation();
    if (!live) return;
    const id = window.setInterval(() => iconRef.current?.startAnimation(), 1600);
    return () => window.clearInterval(id);
  }, [live, data?.today.minutes]);

  if (!data?.status) return null;

  const tone = data.status.tone;
  const border =
    tone === "live"
      ? "border-[var(--color-leaf)]/40 bg-[var(--color-leaf)]/[0.08]"
      : tone === "good"
        ? "border-[var(--color-dawn)]/35 bg-[var(--color-dawn)]/[0.07]"
        : tone === "thin"
          ? "border-[var(--color-ember)]/40 bg-[var(--color-ember)]/[0.08]"
          : "border-white/12 bg-white/[0.03]";
  const kicker =
    tone === "live"
      ? "text-[var(--color-leaf)]"
      : tone === "setup" || tone === "empty"
        ? "text-[var(--color-mist)]"
        : "text-[var(--color-dawn)]";

  const todayLabel = data.periods?.today.label || data.today.label;

  return (
    <section className={`rounded-2xl border px-4 py-4 sm:px-5 ${border}`}>
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${
            live
              ? "border-[var(--color-leaf)]/40 bg-[var(--color-leaf)]/10 text-[var(--color-leaf)]"
              : "border-[var(--color-dawn)]/30 bg-[var(--color-dawn)]/10 text-[var(--color-dawn)]"
          }`}
        >
          <GraduationCapIcon
            ref={iconRef}
            size={30}
            className="cursor-pointer"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`ui-kicker ${kicker}`}>
            Study · today
            {live ? " · live" : ""}
          </p>
          <p className="font-display mt-1 text-[clamp(1.35rem,6vw,1.875rem)] leading-none tabular-nums text-white">
            {todayLabel}
          </p>
          <p className="mt-1.5 truncate text-sm text-[var(--color-mist)]">
            {data.status.tone === "setup" || data.status.tone === "empty"
              ? data.status.body
              : data.status.kicker === "In session"
                ? "Counting now — leave the VC when you stop."
                : "Week, month, and all-time live on Stats."}
          </p>
        </div>
        <Link
          href="/progress"
          className="shrink-0 text-xs text-[var(--color-dawn)]"
        >
          Stats
        </Link>
      </div>
    </section>
  );
}
