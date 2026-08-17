"use client";

import { useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { SleepReport } from "@/components/SleepReport";
import { CloseDayPanel } from "@/components/CloseDayPanel";
import type { HabitLogLike } from "@/lib/habits";
import {
  defaultWindowForKey,
  isInWindow,
  nowMins,
} from "@/lib/habit-windows";

export function SleepClient({
  wakeGoal,
  sleepGoal,
}: {
  wakeGoal: string;
  sleepGoal: string;
}) {
  const [logs, setLogs] = useState<HabitLogLike[]>([]);
  const [today, setToday] = useState("");
  const [bedtime, setBedtime] = useState("");
  const [sleepWin, setSleepWin] = useState(() =>
    defaultWindowForKey("sleepEarly", wakeGoal, sleepGoal)
  );
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  async function refresh() {
    const d = await fetch("/api/habits?days=42").then((r) => r.json());
    setLogs(d.logs || []);
    setToday(d.today || "");
    setBedtime(d.todayLog?.bedtime || "");
    const sleepHabit = (d.habits || []).find(
      (h: { key?: string }) => h.key === "sleepEarly"
    );
    if (sleepHabit?.windowStart && sleepHabit?.windowEnd) {
      setSleepWin({
        start: sleepHabit.windowStart,
        end: sleepHabit.windowEnd,
        source: "custom",
      });
    } else {
      setSleepWin(
        defaultWindowForKey(
          "sleepEarly",
          d.wakeGoal || wakeGoal,
          d.sleepGoal || sleepGoal
        )
      );
    }
  }

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const inSleepWindow = isInWindow(nowMins(), sleepWin.start, sleepWin.end);

  async function goingToSleep() {
    const now = new Date();
    const t = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    await fetch("/api/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bedtime: t, checks: { sleepEarly: true } }),
    });
    await refresh();
  }

  return (
    <main className="dawn-bg relative min-h-screen">
      <div className="app-shell relative z-10 mx-auto w-full max-w-xl md:mx-0 md:max-w-none">
        <AppNav active="sleep" />
        <div className="app-page mt-6 animate-rise space-y-8 sm:mt-10 sm:space-y-10">
          <div>
            <p className="ui-kicker">Night</p>
            <h1 className="ui-title mt-2">Tonight sets tomorrow</h1>
            <p className="ui-sub mt-3">
              {inSleepWindow
                ? "See how much sleep you need (minimum and your plan), how much you took, then close the night."
                : `Need vs take, suggestion, reports, and stats stay below. Set tomorrow opens in your sleep window (${sleepWin.start}–${sleepWin.end}).`}
            </p>
          </div>

          {inSleepWindow ? (
            <CloseDayPanel
              sleepGoal={sleepGoal}
              wakeGoal={wakeGoal}
              bedtimeLogged={Boolean(bedtime)}
              onSleepNow={() => void goingToSleep()}
              onSaved={() => void refresh()}
            />
          ) : null}

          {loading ? (
            <p className="text-[var(--color-mist)]">Loading report…</p>
          ) : today ? (
            <SleepReport
              logs={logs}
              today={today}
              sleepGoal={sleepGoal}
              wakeGoal={wakeGoal}
            />
          ) : (
            <p className="text-[var(--color-mist)]">
              Log a wake or bedtime on Today to unlock your sleep report.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
