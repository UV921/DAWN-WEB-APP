"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AppNav } from "@/components/AppNav";
import { SleepReport } from "@/components/SleepReport";
import { CloseDayPanel } from "@/components/CloseDayPanel";
import type { HabitLogLike } from "@/lib/habits";

export function SleepClient() {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<HabitLogLike[]>([]);
  const [today, setToday] = useState("");
  const [bedtime, setBedtime] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const d = await fetch("/api/habits").then((r) => r.json());
    setLogs(d.logs || []);
    setToday(d.today || "");
    setBedtime(d.todayLog?.bedtime || "");
  }

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, []);

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

  if (!session?.user) {
    return (
      <main className="dawn-bg flex min-h-screen items-center justify-center text-[var(--color-mist)]">
        Loading…
      </main>
    );
  }

  return (
    <main className="dawn-bg noise relative min-h-screen">
      <div className="app-shell relative z-10 mx-auto max-w-3xl">
        <AppNav active="sleep" />
        <div className="mt-6 animate-rise space-y-8 sm:mt-10 sm:space-y-10">
          <div>
            <p className="ui-kicker">Sleep</p>
            <h1 className="ui-title mt-2">Tonight sets tomorrow</h1>
            <p className="ui-sub mt-3">
              Write tomorrow’s wake goal and one sentence for the morning, then
              log bedtime. Scores below show how you’ve been sleeping.
            </p>
          </div>

          <CloseDayPanel
            sleepGoal={session.user.sleepGoal}
            wakeGoal={session.user.wakeGoal}
            bedtimeLogged={Boolean(bedtime)}
            onSleepNow={() => void goingToSleep()}
            onSaved={() => void refresh()}
          />

          {loading ? (
            <p className="text-[var(--color-mist)]">Loading report…</p>
          ) : today ? (
            <SleepReport
              logs={logs}
              today={today}
              sleepGoal={session.user.sleepGoal}
              wakeGoal={session.user.wakeGoal}
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
