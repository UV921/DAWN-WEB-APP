"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { HabitDef, HabitLogLike } from "@/lib/habits";
import type { DayMode } from "@/lib/daily-loop";
import {
  enrichHabitsWithWindows,
  formatDuration,
  isInWindow,
  nowMins,
  defaultWindowForKey,
} from "@/lib/habit-windows";
import { WakeHit } from "@/components/WakeHit";
import { MorningRitual } from "@/components/MorningRitual";
import { MorningAfterWake } from "@/components/MorningAfterWake";
import { NightCloseFlow } from "@/components/NightCloseFlow";
import { TodayOverview } from "@/components/TodayOverview";
import { UiMessage, UiEmpty } from "@/components/UiMessage";
import { MorningPulseCard } from "@/components/MorningPulseCard";
import { DailyLoop, type LoopStep } from "@/components/DailyLoop";
import { TodayTasks, type TodayTodo } from "@/components/TodayTasks";
import { StudyHoursCard } from "@/components/StudyHoursCard";
import {
  buildMorningPulse,
  type MorningPulse,
  type WeekPulse,
} from "@/lib/morning-pulse";

type Streaks = Record<string, { current: number; longest: number }>;

type HabitRow = HabitDef & {
  windowStart?: string;
  windowEnd?: string;
  windowLabel?: string;
  windowStatus?: "open" | "upcoming" | "closed";
  canSubmit?: boolean;
  opensInMin?: number;
  closesInMin?: number;
};

type Profile = {
  xp: number;
  level: number;
  intoLevel: number;
  need: number;
  progress: number;
  focusHabitKey: string;
  identityLine: string;
  whyLine: string;
  totalEarlyWakes: number;
  earlyStreak: number;
  openStreak?: number;
  pledgeText?: string;
  celebrate: "big" | "chill";
  todayAngle?: string;
};

type Todo = TodayTodo;

type Challenge = {
  active: boolean;
  day: number;
  total: number;
  daysLeft: number;
  ended: boolean;
};

type Hit = {
  xpGained: number;
  labels: string[];
  level: number;
  progress: number;
  intoLevel: number;
  need: number;
  streak: number;
  title: string;
  subtitle?: string;
};

type Props = {
  wakeGoal: string;
  sleepGoal: string;
  onData?: (payload: {
    logs: HabitLogLike[];
    streaks: Streaks;
    today: string;
    habits: HabitDef[];
  }) => void;
};

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function emptyChecks(defs: HabitDef[]): Record<string, boolean> {
  return Object.fromEntries(defs.map((h) => [h.key, false]));
}

function friendlyDate(iso: string) {
  if (!iso) return "";
  try {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function firstName(name?: string | null) {
  const part = String(name || "")
    .trim()
    .split(/\s+/)[0];
  return part || "";
}

function timeWish(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function TodayCheckIn({ wakeGoal, sleepGoal, onData }: Props) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [today, setToday] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [bedtime, setBedtime] = useState("");
  const [habitDefs, setHabitDefs] = useState<HabitRow[]>([]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [streaks, setStreaks] = useState<Streaks>({});
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [banner, setBanner] = useState<{
    tone: "warn" | "error" | "success" | "tip";
    text: string;
  } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hit, setHit] = useState<Hit | null>(null);
  const [dayMode, setDayMode] = useState<DayMode>("day");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [todayPlan, setTodayPlan] = useState<{
    goalText?: string;
    wakeGoal?: string | null;
  } | null>(null);
  const [morningFlow, setMorningFlow] = useState("done");
  const [todayTodos, setTodayTodos] = useState<Todo[]>([]);
  const [reminders, setReminders] = useState<
    { id: string; title: string; time: string; enabled: boolean }[]
  >([]);
  const [notifyReady, setNotifyReady] = useState(false);
  const [pulse, setPulse] = useState<MorningPulse | null>(null);
  const [nightFlow, setNightFlow] = useState(false);
  const [timezone, setTimezone] = useState<string | undefined>();
  const tzRef = useRef<string | undefined>(undefined);
  const [, setTick] = useState(0);

  const checksRef = useRef(checks);
  const wakeRef = useRef(wakeTime);
  const bedRef = useRef(bedtime);
  const todayRef = useRef(today);
  const defsRef = useRef(habitDefs);
  checksRef.current = checks;
  wakeRef.current = wakeTime;
  bedRef.current = bedtime;
  todayRef.current = today;
  defsRef.current = habitDefs;

  const applyHabits = useCallback(
    (defs: HabitRow[], tz = tzRef.current) => {
      if (tz) tzRef.current = tz;
      setHabitDefs(
        enrichHabitsWithWindows(
          defs,
          wakeGoal,
          sleepGoal,
          new Date(),
          tzRef.current
        ) as HabitRow[]
      );
    },
    [wakeGoal, sleepGoal]
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/habits?days=42&lite=1");
      if (!res.ok) {
        setLoadError("Couldn’t load today. Check your connection.");
        setLoading(false);
        return;
      }
      setLoadError("");
      const data = await res.json();
      const defs = (data.habits || []) as HabitRow[];
      setToday(data.today);
      setStreaks(data.streaks);
      if (typeof data.timezone === "string") {
        tzRef.current = data.timezone;
        setTimezone(data.timezone);
      }
      applyHabits(defs, data.timezone);
      setDayMode(data.dayMode || "day");
      setChallenge(data.challenge || null);
      setTodayPlan(data.todayPlan || null);
      setMorningFlow(data.morningFlow || "none");
      setTodayTodos(data.todayTodos || []);
      if (data.profile) setProfile(data.profile as Profile);
      const todos = (data.todayTodos || []) as Todo[];
      const tlog = data.todayLog as HabitLogLike | undefined;
      const nextChecks = tlog
        ? { ...emptyChecks(defs), ...(tlog.checks || {}) }
        : emptyChecks(defs);
      const localPulse = buildMorningPulse({
        week: (data.weekPulse as WeekPulse) || {
          days: 0,
          wakeOnTime: 0,
          wakeLogged: 0,
          nightsClosed: 0,
          habitHits: 0,
          habitSlots: 0,
        },
        todayWake: Boolean(tlog?.wakeTime),
        habitsDone: defs.filter((h) => nextChecks[h.key]).length,
        habitsTotal: defs.length || 1,
        tasksDone: todos.filter((x) => x.done).length,
        tasksTotal: todos.length,
        nightClosed: Boolean(tlog?.bedtime),
        streak: data.profile?.earlyStreak || 0,
        runDay: data.challenge?.active ? data.challenge.day : undefined,
        runTotal: data.challenge?.total,
        nextHabit:
          defs.find((h) => !nextChecks[h.key] && h.canSubmit)?.label ||
          defs.find((h) => !nextChecks[h.key])?.label,
        tasksLeft: Math.max(
          0,
          todos.length - todos.filter((x) => x.done).length
        ),
      });
      setPulse(localPulse);
      void fetch("/api/reminders")
        .then((r) => r.json())
        .then((d: { reminders?: { id: string; title: string; time: string; enabled: boolean }[] }) => {
          setReminders((d.reminders || []).filter((x) => x.enabled));
        })
        .catch(() => undefined);
      onData?.({
        logs: data.logs || [],
        streaks: data.streaks,
        today: data.today,
        habits: defs,
      });
      if (data.todayLog) {
        const t = data.todayLog as HabitLogLike;
        setWakeTime(t.wakeTime || "");
        setBedtime(t.bedtime || "");
        setChecks({ ...emptyChecks(defs), ...(t.checks || {}) });
      } else {
        setChecks(emptyChecks(defs));
      }
    } catch {
      setLoadError("Something went wrong loading today.");
    } finally {
      setLoading(false);
    }
  }, [applyHabits, onData]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        applyHabits(defsRef.current);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [applyHabits]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setNotifyReady(Notification.permission === "granted");
  }, []);

  const persist = useCallback(
    async (
      nextChecks: Record<string, boolean>,
      nextWake: string,
      nextBed: string,
      send: { wake?: boolean; bed?: boolean; checkKeys?: string[] } = {}
    ) => {
      const date = todayRef.current;
      if (!date) return false;
      setSaving(true);
      setStatus("idle");
      setBanner(null);
      try {
        const checksPayload = send.checkKeys
          ? Object.fromEntries(
              send.checkKeys.map((k) => [k, Boolean(nextChecks[k])])
            )
          : nextChecks;
        const res = await fetch("/api/habits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            nowMins: nowMins(new Date(), tzRef.current),
            ...(send.wake ? { wakeTime: nextWake || null } : {}),
            ...(send.bed ? { bedtime: nextBed || null } : {}),
            checks: checksPayload,
          }),
        });
        setSaving(false);
        if (!res.ok) {
          setStatus("error");
          setBanner({
            tone: "error",
            text: "Couldn’t save. Try once more.",
          });
          return false;
        }
        const saved = await res.json();
        if (saved.rejected?.length) {
          setBanner({
            tone: "warn",
            text: (saved.rejected as { reason: string }[])
              .map((r) => r.reason)
              .slice(0, 2)
              .join(" · "),
          });
          await load();
          return false;
        }
        if (saved.hit) {
          setHit(saved.hit as Hit);
          setProfile((p) =>
            p
              ? {
                  ...p,
                  xp: (p.xp || 0) + saved.hit.xpGained,
                  level: saved.hit.level,
                  progress: saved.hit.progress,
                  intoLevel: saved.hit.intoLevel,
                  need: saved.hit.need,
                  earlyStreak: saved.hit.streak,
                }
              : p
          );
        }
        setStatus("saved");
        window.setTimeout(() => setStatus("idle"), 1200);
        return true;
      } catch {
        setSaving(false);
        setStatus("error");
        return false;
      }
    },
    [load]
  );

  async function toggleHabit(h: HabitRow) {
    const live = enrichHabitsWithWindows(
      defsRef.current,
      wakeGoal,
      sleepGoal,
      new Date(),
      tzRef.current
    ) as HabitRow[];
    const row = live.find((x) => x.key === h.key) || h;
    const done = checksRef.current[h.key];
    if (!done && !row.canSubmit) {
      setBanner({
        tone: "tip",
        text: row.opensInMin
          ? `${h.label} opens in ${formatDuration(row.opensInMin)} (${row.windowStart}–${row.windowEnd})`
          : `${h.label} isn’t open yet. Window ${row.windowStart}–${row.windowEnd}.`,
      });
      return;
    }
    if (h.key === "sleepEarly" && !done) {
      setNightFlow(true);
      return;
    }
    const prev = checksRef.current;
    const next = { ...prev, [h.key]: !done };
    setChecks(next);
    const ok = await persist(next, wakeRef.current, bedRef.current, {
      checkKeys: [h.key],
    });
    if (!ok) setChecks(prev);
  }

  async function goingToSleep() {
    if (bedRef.current) return;
    const t = nowHHMM();
    const prevChecks = checksRef.current;
    const next = { ...prevChecks, sleepEarly: true };
    setBedtime(t);
    setChecks(next);
    const ok = await persist(next, wakeRef.current, t, {
      bed: true,
      checkKeys: ["sleepEarly"],
    });
    if (!ok) {
      setBedtime("");
      setChecks(prevChecks);
      throw new Error("Couldn’t log sleep. Try again.");
    }
  }

  async function wokeUp() {
    if (wakeRef.current) return;
    const t = nowHHMM();
    const prevChecks = checksRef.current;
    const next = { ...prevChecks, wakeEarly: true };
    setWakeTime(t);
    setChecks(next);
    const ok = await persist(next, t, bedRef.current, {
      wake: true,
      checkKeys: ["wakeEarly"],
    });
    if (!ok) {
      setWakeTime("");
      setChecks(prevChecks);
    }
  }

  async function startChallenge(days: number) {
    const res = await fetch("/api/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days }),
    });
    if (res.ok) {
      setBanner({
        tone: "success",
        text: `${days}-day challenge started.`,
      });
      await load();
    }
  }

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setBanner({
        tone: "tip",
        text: "On iPhone: add Dawn to the Home Screen, then allow alerts. Discord reminders still work with the app closed.",
      });
      return;
    }
    const p = await Notification.requestPermission();
    setNotifyReady(p === "granted");
    setBanner({
      tone: p === "granted" ? "success" : "tip",
      text:
        p === "granted"
          ? "Alerts on while Dawn is open. Use Discord for pings when it’s closed."
          : "Alerts stayed off. Discord reminders still work.",
    });
  }

  const liveHabits = enrichHabitsWithWindows(
    habitDefs,
    wakeGoal,
    sleepGoal,
    new Date(),
    tzRef.current || timezone
  ) as HabitRow[];

  if (loading) {
    return (
      <div className="dash-board py-4">
        <div className="space-y-3">
          <div className="h-3 w-36 rounded bg-white/10" />
          <div className="h-9 w-64 rounded bg-white/10" />
          <div className="h-4 w-80 max-w-full rounded bg-white/5" />
        </div>
        <div className="dash-pair">
          <div className="h-44 rounded-[1.1rem] bg-white/[0.04]" />
          <div className="mt-4 h-44 rounded-[1.1rem] bg-white/[0.04] lg:mt-0" />
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <div className="h-24 rounded-[1.1rem] bg-white/[0.04]" />
          <div className="h-24 rounded-[1.1rem] bg-white/[0.04]" />
          <div className="h-24 rounded-[1.1rem] bg-white/[0.04]" />
          <div className="h-24 rounded-[1.1rem] bg-white/[0.04]" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <UiEmpty
        kicker="Today"
        title="Couldn’t load today"
        body={loadError}
        action={
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="ui-btn ui-btn-primary"
          >
            Try again
          </button>
        }
      />
    );
  }

  const done = liveHabits.filter((h) => checks[h.key]).length;
  const openNow = liveHabits.filter((h) => h.canSubmit && !checks[h.key]);
  const nextLocked = liveHabits
    .filter((h) => !checks[h.key] && !h.canSubmit)
    .sort((a, b) => (a.opensInMin || 99_999) - (b.opensInMin || 99_999))[0];
  const focusKey = profile?.focusHabitKey || "wakeEarly";
  const sortedHabits = [...liveHabits].sort((a, b) => {
    if (a.canSubmit !== b.canSubmit) return a.canSubmit ? -1 : 1;
    if (a.key === focusKey) return -1;
    if (b.key === focusKey) return 1;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
  const wakeHabit = liveHabits.find((h) => h.key === "wakeEarly");
  const wakeWindowOpen = Boolean(wakeHabit?.canSubmit);
  const sleepHabit = liveHabits.find((h) => h.key === "sleepEarly");
  const sleepWin =
    sleepHabit?.windowStart && sleepHabit?.windowEnd
      ? { start: sleepHabit.windowStart, end: sleepHabit.windowEnd }
      : defaultWindowForKey("sleepEarly", wakeGoal, sleepGoal);
  const inSleepWindow = isInWindow(
    nowMins(new Date(), tzRef.current || timezone),
    sleepWin.start,
    sleepWin.end
  );

  const tasksDone = todayTodos.filter((t) => t.done).length;
  const hello = firstName(session?.user?.name);
  const nextLine = wakeTime
    ? openNow[0]
      ? `Next: ${openNow[0].label}${openNow[0].closesInMin ? ` · ${formatDuration(openNow[0].closesInMin)} left` : ""}`
      : nextLocked
        ? `Next: ${nextLocked.label} in ${formatDuration(nextLocked.opensInMin || 0)}`
        : "Morning habits done."
    : null;

  const loopSteps: LoopStep[] = [
    {
      key: "wake",
      label: "Wake up",
      detail: wakeTime || `by ${wakeGoal}`,
      done: Boolean(wakeTime),
    },
    {
      key: "habits",
      label: "Habits",
      detail: `${done}/${liveHabits.length || 1} done`,
      done: liveHabits.length > 0 && done >= liveHabits.length,
    },
    {
      key: "tasks",
      label: "Tasks",
      detail: todayTodos.length
        ? `${tasksDone}/${todayTodos.length} done`
        : "none yet",
      done: todayTodos.length > 0 && tasksDone === todayTodos.length,
      href: "/tasks",
    },
    {
      key: "night",
      label: "Sleep",
      detail: bedtime || `by ${sleepGoal}`,
      done: Boolean(bedtime),
      href: "/sleep",
    },
  ];

  const wakeAction = !wakeTime ? (
    <MorningRitual
      pledge={profile?.pledgeText}
      planWake={todayPlan?.wakeGoal || wakeGoal}
      disabled={saving || !wakeWindowOpen}
      alreadyUp={false}
      windowOpen={wakeWindowOpen}
      windowStart={wakeHabit?.windowStart}
      windowEnd={wakeHabit?.windowEnd}
      opensInMin={wakeHabit?.opensInMin}
      onRise={() => void wokeUp()}
    />
  ) : null;

  if (nightFlow && !bedtime) {
    return (
      <>
        <WakeHit
          open={Boolean(hit)}
          title={hit?.title || ""}
          subtitle={hit?.subtitle}
          xpGained={hit?.xpGained || 0}
          labels={hit?.labels || []}
          level={hit?.level || 1}
          progress={hit?.progress || 0}
          streak={hit?.streak || 0}
          celebrate={profile?.celebrate || "chill"}
          onClose={() => setHit(null)}
        />
        <NightCloseFlow
          name={hello}
          sleepGoal={sleepGoal}
          wakeGoal={wakeGoal}
          bedtimeLogged={false}
          inSleepWindow={inSleepWindow}
          sleepWindowLabel={`${sleepWin.start}–${sleepWin.end}`}
          onSleepNow={goingToSleep}
          onSaved={() => {
            setNightFlow(false);
            void load();
          }}
          onCancel={() => setNightFlow(false)}
        />
      </>
    );
  }

  const morningSetup =
    wakeTime && morningFlow !== "done" ? (
      <MorningAfterWake
        open
        date={today}
        initialStep={morningFlow === "todos" ? "todos" : "reminders"}
        onDone={() => {
          setMorningFlow("done");
          void load();
        }}
      />
    ) : null;

  const habitsPanel = (
    <section className="dash-panel">
      <div className="ui-section-head">
        <div>
          <h2 className="ui-section-title text-[1.15rem]">Habits</h2>
          <p className="ui-section-help">Tap each one when you finish it.</p>
        </div>
        <Link
          href="/settings?tab=habits"
          className="shrink-0 text-xs text-[var(--color-mist)] hover:text-white"
        >
          Edit
        </Link>
      </div>
      <ul className="flex flex-1 flex-col gap-2">
        {sortedHabits.map((h) => {
          const isDone = Boolean(checks[h.key]);
          const locked = !isDone && !h.canSubmit;
          return (
            <li key={h.key}>
              <button
                type="button"
                onClick={() => void toggleHabit(h)}
                disabled={saving}
                className={`ui-row ${isDone ? "is-done" : ""} ${locked ? "is-locked" : ""}`}
              >
                <span className={`ui-check ${isDone ? "is-on" : ""}`}>✓</span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block font-medium text-white">{h.label}</span>
                  <span className="mt-0.5 block text-xs text-[var(--color-mist)]">
                    {isDone
                      ? "Done"
                      : locked
                        ? h.opensInMin
                          ? `Opens in ${formatDuration(h.opensInMin)}`
                          : `From ${h.windowStart || "—"}`
                        : `Tap · until ${h.windowEnd}`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );

  const remindersPanel = (
    <section className="dash-panel">
      <div className="ui-section-head">
        <div>
          <h2 className="ui-section-title text-[1.15rem]">Reminders</h2>
          <p className="ui-section-help">Alerts you set for today.</p>
        </div>
        <Link
          href="/settings?tab=reminders"
          className="shrink-0 text-xs text-[var(--color-mist)] hover:text-white"
        >
          Edit
        </Link>
      </div>
      {reminders.length ? (
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {reminders.map((r) => (
            <li key={r.id} className="ui-row !min-h-0 !py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm text-white">
                {r.title}
              </span>
              <span className="shrink-0 tabular-nums text-[13px] text-[var(--color-dawn)]">
                {r.time}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--color-mist)]">
          None yet. Add some from Settings, or when you close the night.
        </p>
      )}
    </section>
  );

  const nightCard =
    inSleepWindow && !bedtime ? (
      <button
        type="button"
        onClick={() => setNightFlow(true)}
        className="block w-full rounded-[1.1rem] border border-[var(--color-dawn)]/30 bg-[var(--color-dawn)]/[0.07] px-5 py-5 text-left"
      >
        <p className="ui-kicker">Night</p>
        <p className="font-display mt-2 text-2xl text-white">Close the day</p>
        <p className="mt-1 text-sm text-[var(--color-mist)]">
          Remember anything, set tomorrow’s tasks, then sleep.
        </p>
      </button>
    ) : null;

  return (
    <>
      <WakeHit
        open={Boolean(hit)}
        title={hit?.title || ""}
        subtitle={hit?.subtitle}
        xpGained={hit?.xpGained || 0}
        labels={hit?.labels || []}
        level={hit?.level || 1}
        progress={hit?.progress || 0}
        streak={hit?.streak || 0}
        celebrate={profile?.celebrate || "chill"}
        onClose={() => setHit(null)}
      />

      <div className="dash-board">
        <header className="dash-hero min-w-0">
          <p className="ui-kicker">
            {friendlyDate(today) || "Today"}
            {wakeTime ? ` · up ${wakeTime}` : ` · wake ${wakeGoal}`}
          </p>
          <h1 className="ui-title mt-2">
            {hello ? `${timeWish()}, ${hello}` : timeWish()}
          </h1>
          {todayPlan?.goalText ? (
            <p className="ui-sub mt-2">{todayPlan.goalText}</p>
          ) : (
            <p className="ui-sub mt-2">
              Wake up, do your habits, finish your tasks.
            </p>
          )}
        </header>

        {banner ? <UiMessage tone={banner.tone}>{banner.text}</UiMessage> : null}
        {morningSetup}

        <DailyLoop steps={loopSteps} />

        <div className="dash-pair">
          <div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
            {pulse ? <MorningPulseCard pulse={pulse} /> : null}
            {wakeTime && morningFlow === "done" && nextLine ? (
              <p className="text-sm text-[var(--color-mist)] lg:hidden">
                {nextLine}
              </p>
            ) : null}
          </div>
          <div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
            {wakeAction}
            <div className="flex min-h-0 flex-1 flex-col">
              <StudyHoursCard />
            </div>
          </div>
        </div>

        <TodayOverview
          earlyStreak={profile?.earlyStreak || 0}
          habitsDone={done}
          habitsTotal={liveHabits.length || 1}
          xp={profile?.xp || 0}
          level={profile?.level || 1}
          intoLevel={profile?.intoLevel || 0}
          need={profile?.need || 80}
          challenge={challenge}
          onStartChallenge={(days) => void startChallenge(days)}
        />

        <div className="dash-work">
          {habitsPanel}
          <div className="dash-panel">
            <TodayTasks
              date={today}
              todos={todayTodos}
              onChange={setTodayTodos}
              onError={(text) => setBanner({ tone: "error", text })}
              title="Today's tasks"
              hint="Add what you need to finish on the Tasks page. Come back here to check them off."
              allowAdd={false}
              addHref="/tasks"
              addLabel="Add a task"
            />
          </div>
        </div>

        <div className={`dash-foot${nightCard ? " is-split" : ""}`}>
          {remindersPanel}
          {nightCard}
        </div>

        {!notifyReady ? (
          <button
            type="button"
            onClick={() => void enableNotifications()}
            className="ui-btn-text text-sm"
          >
            Turn on notifications
          </button>
        ) : null}

        {(saving || status === "saved" || status === "error") && (
          <p
            className={`text-sm ${
              status === "error"
                ? "text-red-300"
                : status === "saved"
                  ? "text-[var(--color-leaf)]"
                  : "text-[var(--color-mist)]"
            }`}
            aria-live="polite"
          >
            {saving
              ? "Saving…"
              : status === "saved"
                ? "Saved"
                : "Couldn’t save — try again"}
          </p>
        )}
      </div>
    </>
  );
}
