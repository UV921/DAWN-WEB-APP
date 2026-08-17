"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AppNav } from "@/components/AppNav";
import { SleepReport } from "@/components/SleepReport";
import { NightCloseFlow } from "@/components/NightCloseFlow";
import { NightClosed } from "@/components/NightClosed";
import type { HabitLogLike } from "@/lib/habits";
import {
  defaultWindowForKey,
  isInWindow,
  nowMins,
} from "@/lib/habit-windows";

function firstName(name?: string | null) {
  const part = String(name || "")
    .trim()
    .split(/\s+/)[0];
  return part || "";
}

export function SleepClient({
  wakeGoal,
  sleepGoal,
}: {
  wakeGoal: string;
  sleepGoal: string;
}) {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<HabitLogLike[]>([]);
  const [today, setToday] = useState("");
  const [bedtime, setBedtime] = useState("");
  const [planWake, setPlanWake] = useState(wakeGoal);
  const [sleepWin, setSleepWin] = useState(() =>
    defaultWindowForKey("sleepEarly", wakeGoal, sleepGoal)
  );
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  async function refresh() {
    const [d, plan] = await Promise.all([
      fetch("/api/habits?days=42").then((r) => r.json()),
      fetch("/api/day-plan")
        .then((r) => r.json())
        .catch(() => ({})),
    ]);
    setLogs(d.logs || []);
    setToday(d.today || "");
    setBedtime(d.todayLog?.bedtime || "");
    if (plan.tomorrowPlan?.wakeGoal) setPlanWake(plan.tomorrowPlan.wakeGoal);
    else if (d.wakeGoal) setPlanWake(d.wakeGoal);
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

  async function goingToSleep() {
    const now = new Date();
    const t = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;
    const res = await fetch("/api/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bedtime: t,
        checks: { sleepEarly: true },
        nowMins: nowMins(now),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.rejected?.length) {
      throw new Error(
        (data.rejected as { reason: string }[] | undefined)?.[0]?.reason ||
          "Couldn’t log sleep."
      );
    }
    await refresh();
  }

  const inSleepWindow = isInWindow(nowMins(), sleepWin.start, sleepWin.end);
  const nightDone = Boolean(bedtime);
  const hello = firstName(session?.user?.name);

  return (
    <main className="dawn-bg relative min-h-screen">
      <div className="app-shell relative z-10 mx-auto w-full max-w-xl md:mx-0 md:max-w-none">
        <AppNav active="sleep" />
        <div className="app-page mt-6 animate-rise space-y-8 sm:mt-10 sm:space-y-10">
          {loading ? (
            <p className="text-[var(--color-mist)]">Loading tonight…</p>
          ) : nightDone ? (
            <>
              <NightClosed sleepGoal={sleepGoal} wakeGoal={planWake} />
              {today ? (
                <SleepReport
                  logs={logs}
                  today={today}
                  sleepGoal={sleepGoal}
                  wakeGoal={wakeGoal}
                />
              ) : null}
            </>
          ) : (
            <NightCloseFlow
              name={hello}
              sleepGoal={sleepGoal}
              wakeGoal={wakeGoal}
              bedtimeLogged={false}
              inSleepWindow={inSleepWindow}
              sleepWindowLabel={`${sleepWin.start}–${sleepWin.end}`}
              onSleepNow={goingToSleep}
              onSaved={() => void refresh()}
            />
          )}
        </div>
      </div>
    </main>
  );
}
