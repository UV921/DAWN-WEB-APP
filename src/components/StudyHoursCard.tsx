"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GraduationCapIcon } from "@/components/ui/graduation-cap";
import type { GraduationCapIconHandle } from "@/components/ui/graduation-cap";
import { StudyActivityControls } from "@/components/StudyActivityControls";
import { StudyCareControls } from "@/components/StudyCareControls";
import { type StudyStats } from "@/components/StudyStatusPanel";
import { announceStudySession } from "@/lib/study-session-events";

export function StudyHoursCard({
  onMinutes,
}: {
  onMinutes?: (minutes: number) => void;
}) {
  const [data, setData] = useState<StudyStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iconRef = useRef<GraduationCapIconHandle>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/study?lite=1", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as StudyStats;
      setData(json);
      onMinutes?.(json.today?.minutes || 0);
      announceStudySession({
        live: Boolean(json.today?.live),
        sessionId: json.today?.live ? json.today.liveStartedAt : null,
      });
    } catch {
      /* ignore */
    }
  }, [onMinutes]);

  async function act(
    action: "start" | "stop" | "set-activity",
    extra?: { activityKey?: string; activity?: string }
  ) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/study", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Could not update the session.");
        return;
      }
      if (action === "stop") {
        announceStudySession({ live: false, sessionId: null });
      }
      await load();
    } catch {
      setError("Could not update the session.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  const live = Boolean(data?.today.live);
  useEffect(() => {
    const ms = live ? 10_000 : 45_000;
    const id = window.setInterval(() => void load(), ms);
    return () => window.clearInterval(id);
  }, [load, live]);
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
  const doing = data.today.activity;

  return (
    <section className={`flex h-full min-h-0 flex-col rounded-2xl border px-4 py-4 sm:px-5 ${border}`}>
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
            Study{live ? " · live" : " · today"}
          </p>
          {live ? (
            <>
              <p className="font-display mt-1 break-words text-[clamp(1.35rem,6vw,1.875rem)] leading-[1.15] text-white">
                {doing || "What are you doing?"}
              </p>
              <p className="mt-1.5 text-sm text-[var(--color-mist)]">
                {todayLabel} today
                {doing ? "" : " · pick on this card"}
              </p>
            </>
          ) : (
            <>
              <p className="font-display mt-1 text-[clamp(1.35rem,6vw,1.875rem)] leading-none tabular-nums text-white">
                {todayLabel}
              </p>
              <p className="mt-1.5 truncate text-sm text-[var(--color-mist)]">
                {data.status.tone === "setup"
                  ? data.status.body
                  : "Start on this card, or join a study VC."}
              </p>
            </>
          )}
        </div>
        <Link
          href="/progress"
          className="shrink-0 text-xs text-[var(--color-dawn)]"
        >
          Stats
        </Link>
      </div>
      <div className="mt-auto">
        <StudyActivityControls
          live={live}
          source={data.today.source}
          activity={data.today.activity}
          activityKey={data.today.activityKey}
          busy={busy}
          error={error}
          onPick={(key) =>
            void act(live ? "set-activity" : "start", { activityKey: key })
          }
          onCustom={(text) =>
            void act(live ? "set-activity" : "start", {
              activityKey: "custom",
              activity: text,
            })
          }
          onStart={() => void act("start")}
          onStop={() => void act("stop")}
        />
        <StudyCareControls live={live} />
      </div>
    </section>
  );
}
