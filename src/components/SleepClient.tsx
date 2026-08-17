"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AppNav } from "@/components/AppNav";
import { SleepReport } from "@/components/SleepReport";
import { NightCloseFlow } from "@/components/NightCloseFlow";
import { NightClosed } from "@/components/NightClosed";
import type { HabitLogLike } from "@/lib/habits";

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
  const [loading, setLoading] = useState(true);

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
              onSleepNow={goingToSleep}
              onSaved={() => void refresh()}
            />
          )}
        </div>
      </div>
    </main>
  );
}
