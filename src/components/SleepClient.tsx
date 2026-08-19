"use client";

import { useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { SleepReport } from "@/components/SleepReport";
import { DayTallyCard } from "@/components/DayTallyCard";
import type { HabitLogLike } from "@/lib/habits";
import {
  buildDayTally,
  emptyDayTally,
  type DayTally,
} from "@/lib/day-tally";

type StudyToday = { today?: { minutes?: number } };

export function SleepClient({
  wakeGoal,
  sleepGoal,
}: {
  wakeGoal: string;
  sleepGoal: string;
}) {
  const [logs, setLogs] = useState<HabitLogLike[]>([]);
  const [today, setToday] = useState("");
  const [tally, setTally] = useState<DayTally>(() =>
    emptyDayTally(wakeGoal, sleepGoal)
  );
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [d, study] = await Promise.all([
      fetch("/api/habits?days=42").then((r) => r.json()),
      fetch("/api/study")
        .then((r) => r.json() as Promise<StudyToday>)
        .catch(() => null),
    ]);
    setLogs(d.logs || []);
    setToday(d.today || "");
    setTally(
      buildDayTally({
        wakeTime: d.todayLog?.wakeTime,
        wakeGoal: d.wakeGoal || wakeGoal,
        bedtime: d.todayLog?.bedtime,
        sleepGoal: d.sleepGoal || sleepGoal,
        habits: d.habits,
        checks: d.todayLog?.checks || {},
        todos: d.todayTodos,
        studyMinutes: study?.today?.minutes || 0,
        streak: d.profile?.earlyStreak,
      })
    );
  }

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, []);

  return (
    <main className="dawn-bg relative min-h-screen">
      <div className="app-shell relative z-10 mx-auto w-full max-w-xl md:mx-0 md:max-w-none">
        <AppNav active="sleep" />
        <div className="app-page mt-6 animate-rise space-y-8 sm:mt-10 sm:space-y-10">
          <div>
            <p className="ui-kicker">Night</p>
            <h1 className="ui-title mt-2">Sleep report</h1>
            <p className="ui-sub mt-3">
              How much sleep you need, how much you took, and how the nights
              behind you look.
            </p>
          </div>

          {loading ? (
            <p className="text-[var(--color-mist)]">Loading report…</p>
          ) : today ? (
            <>
              <DayTallyCard tally={tally} />
              <SleepReport
                logs={logs}
                today={today}
                sleepGoal={sleepGoal}
                wakeGoal={wakeGoal}
              />
            </>
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
