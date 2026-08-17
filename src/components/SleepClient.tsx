"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AppNav } from "@/components/AppNav";
import { SleepReport } from "@/components/SleepReport";
import { NightCloseFlow } from "@/components/NightCloseFlow";
import { NightClosed } from "@/components/NightClosed";
import { NightTally } from "@/components/NightTally";
import { SleepHabitButton } from "@/components/SleepHabitButton";
import { DayTallyCard } from "@/components/DayTallyCard";
import { UiMessage } from "@/components/UiMessage";
import type { HabitLogLike } from "@/lib/habits";
import {
  defaultWindowForKey,
  isInWindow,
  nowMins,
} from "@/lib/habit-windows";
import {
  buildDayTally,
  emptyDayTally,
  type DayTally,
  type TallyHit,
} from "@/lib/day-tally";

function firstName(name?: string | null) {
  const part = String(name || "")
    .trim()
    .split(/\s+/)[0];
  return part || "";
}

type StudyToday = { today?: { minutes?: number } };

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
  const [sleepLabel, setSleepLabel] = useState("Sleep early");
  const [tally, setTally] = useState<DayTally>(() =>
    emptyDayTally(wakeGoal, sleepGoal)
  );
  const [hit, setHit] = useState<TallyHit | null>(null);
  const [showTally, setShowTally] = useState(false);
  const [celebrate, setCelebrate] = useState<"big" | "chill">("big");
  const [sleepErr, setSleepErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  const applyTally = useCallback(
    (
      d: {
        todayLog?: HabitLogLike | null;
        habits?: { key: string }[];
        todayTodos?: { done?: boolean; parentId?: string | null }[];
        wakeGoal?: string;
        sleepGoal?: string;
        profile?: { earlyStreak?: number; celebrate?: string };
      },
      studyMinutes: number
    ) => {
      const habits = d.habits || [];
      setTally(
        buildDayTally({
          wakeTime: d.todayLog?.wakeTime,
          wakeGoal: d.wakeGoal || wakeGoal,
          bedtime: d.todayLog?.bedtime,
          sleepGoal: d.sleepGoal || sleepGoal,
          habits,
          checks: d.todayLog?.checks || {},
          todos: d.todayTodos,
          studyMinutes,
          streak: d.profile?.earlyStreak,
        })
      );
      if (d.profile?.celebrate === "chill" || d.profile?.celebrate === "big") {
        setCelebrate(d.profile.celebrate);
      }
    },
    [wakeGoal, sleepGoal]
  );

  async function refresh() {
    const [d, plan, study] = await Promise.all([
      fetch("/api/habits?days=42").then((r) => r.json()),
      fetch("/api/day-plan")
        .then((r) => r.json())
        .catch(() => ({})),
      fetch("/api/study")
        .then((r) => r.json() as Promise<StudyToday>)
        .catch(() => null),
    ]);
    setLogs(d.logs || []);
    setToday(d.today || "");
    setBedtime(d.todayLog?.bedtime || "");
    if (plan.tomorrowPlan?.wakeGoal) setPlanWake(plan.tomorrowPlan.wakeGoal);
    else if (d.wakeGoal) setPlanWake(d.wakeGoal);
    const sleepHabit = (d.habits || []).find(
      (h: { key?: string; label?: string }) => h.key === "sleepEarly"
    );
    if (sleepHabit?.label) setSleepLabel(sleepHabit.label);
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
    applyTally(d, study?.today?.minutes || 0);
  }

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  async function goingToSleep() {
    setSleepErr("");
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
      const msg =
        (data.rejected as { reason: string }[] | undefined)?.[0]?.reason ||
        "Couldn’t log sleep.";
      setSleepErr(msg);
      throw new Error(msg);
    }
    setBedtime(t);
    setTally((prev) => ({ ...prev, bedtime: t }));
    if (data.hit) setHit(data.hit as TallyHit);
    setShowTally(true);
    await refresh();
  }

  const closeTally = useCallback(() => setShowTally(false), []);

  const inSleepWindow = isInWindow(nowMins(), sleepWin.start, sleepWin.end);
  const nightDone = Boolean(bedtime);
  const hello = firstName(session?.user?.name);

  return (
    <main className="dawn-bg relative min-h-screen">
      <NightTally
        open={showTally}
        tally={tally}
        hit={hit}
        celebrate={celebrate}
        onClose={closeTally}
      />
      <div className="app-shell relative z-10 mx-auto w-full max-w-xl md:mx-0 md:max-w-none">
        <AppNav active="sleep" />
        <div className="app-page mt-6 animate-rise space-y-8 sm:mt-10 sm:space-y-10">
          {loading ? (
            <p className="text-[var(--color-mist)]">Loading tonight…</p>
          ) : nightDone ? (
            <>
              <NightClosed
                sleepGoal={sleepGoal}
                wakeGoal={planWake}
                tally={tally}
              />
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
            <>
              <header>
                <p className="ui-kicker">Close the night</p>
                <h1 className="ui-title mt-2">
                  {hello ? `${hello}, tap Sleep` : "Tap Sleep"}
                </h1>
                <p className="ui-sub mt-3">
                  The sleep habit closes tonight automatically. Tomorrow’s plan
                  can wait underneath.
                </p>
              </header>
              <DayTallyCard tally={tally} />
              <SleepHabitButton
                label={sleepLabel}
                inWindow={inSleepWindow}
                windowLabel={`${sleepWin.start}–${sleepWin.end}`}
                onSleep={goingToSleep}
              />
              {sleepErr ? (
                <UiMessage tone="error">{sleepErr}</UiMessage>
              ) : null}
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
            </>
          )}
        </div>
      </div>
    </main>
  );
}
