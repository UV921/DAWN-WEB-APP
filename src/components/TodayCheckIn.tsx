"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { HabitDef, HabitLogLike } from "@/lib/habits";
import type { DayMode } from "@/lib/daily-loop";
import { formatDuration } from "@/lib/habit-windows";
import { WakeHit } from "@/components/WakeHit";
import { MorningRitual } from "@/components/MorningRitual";
import { MorningAfterWake } from "@/components/MorningAfterWake";
import { CloseDayPanel } from "@/components/CloseDayPanel";
import { TodayOverview } from "@/components/TodayOverview";
import { UiMessage, UiEmpty } from "@/components/UiMessage";

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
};

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

type Todo = { id: string; text: string; done: boolean };

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
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function TodayCheckIn({ wakeGoal, sleepGoal, onData }: Props) {
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
  const [todayTodos, setTodayTodos] = useState<Todo[]>([]);
  const [notifyReady, setNotifyReady] = useState(false);
  const [missionKeys, setMissionKeys] = useState<string[]>([]);
  const [morningFlow, setMorningFlow] = useState<
    "none" | "reminders" | "todos" | "done"
  >("none");
  const [showAfterWake, setShowAfterWake] = useState(false);

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

  const load = useCallback(async () => {
    try {
      const [res, missionRes] = await Promise.all([
        fetch("/api/habits?days=400"),
        fetch("/api/mission"),
      ]);
      if (!res.ok) {
        setLoadError(
          "Couldn’t load today. Check your connection, then try again."
        );
        setLoading(false);
        return;
      }
      setLoadError("");
      const data = await res.json();
      const defs = (data.habits || []) as HabitRow[];
      setToday(data.today);
      setStreaks(data.streaks);
      setHabitDefs(defs);
      setDayMode(data.dayMode || "day");
      setChallenge(data.challenge || null);
      setTodayPlan(data.todayPlan || null);
      setTodayTodos(data.todayTodos || []);
      if (data.profile) setProfile(data.profile as Profile);

      if (missionRes.ok) {
        const m = await missionRes.json();
        const flow = (m.morningFlow || "none") as
          | "none"
          | "reminders"
          | "todos"
          | "done";
        setMorningFlow(flow);
        setMissionKeys(
          Array.isArray(m.mission?.habitKeys) ? m.mission.habitKeys : []
        );
        if (m.todos?.length) setTodayTodos(m.todos);
        if (
          data.todayLog?.wakeTime &&
          (flow === "reminders" || flow === "todos")
        ) {
          setShowAfterWake(true);
        } else if (flow === "done" || flow === "none") {
          setShowAfterWake(false);
        }
      }

      onData?.({
        logs: data.logs,
        streaks: data.streaks,
        today: data.today,
        habits: defs,
      });
      if (data.todayLog) {
        const t = data.todayLog as HabitLogLike;
        setWakeTime(t.wakeTime || "");
        setBedtime(t.bedtime || "");
        setChecks({
          ...emptyChecks(defs),
          ...(t.checks || {}),
        });
      } else {
        setChecks(emptyChecks(defs));
      }
    } catch {
      setLoadError("Something went wrong loading today. Pull to refresh.");
    } finally {
      setLoading(false);
    }
  }, [onData]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setNotifyReady(Notification.permission === "granted");
  }, []);

  const persist = useCallback(
    async (
      nextChecks: Record<string, boolean>,
      nextWake: string,
      nextBed: string
    ) => {
      const date = todayRef.current;
      if (!date) return;
      setSaving(true);
      setStatus("idle");
      setBanner(null);
      const res = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          wakeTime: nextWake || null,
          bedtime: nextBed || null,
          checks: nextChecks,
        }),
      });
      setSaving(false);
      if (!res.ok) {
        setStatus("error");
        setBanner({
          tone: "error",
          text: "Couldn’t save that check-in. Try once more.",
        });
        return;
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
      await load();
      window.setTimeout(() => setStatus("idle"), 1600);
    },
    [load]
  );

  async function toggleHabit(h: HabitRow) {
    const done = checksRef.current[h.key];
    if (!done && !h.canSubmit) {
      setBanner({
        tone: "tip",
        text: h.opensInMin
          ? `${h.label} opens in ${formatDuration(h.opensInMin)} (${h.windowStart}–${h.windowEnd}). Come back then.`
          : `${h.label} isn’t open yet — ${h.windowLabel || "outside its time window"}.`,
      });
      return;
    }
    const next = {
      ...checksRef.current,
      [h.key]: !done,
    };
    setChecks(next);
    await persist(next, wakeRef.current, bedRef.current);
  }

  async function wokeUp() {
    const wakeHabit = defsRef.current.find((h) => h.key === "wakeEarly");
    if (wakeHabit && !wakeHabit.canSubmit) {
      setBanner({
        tone: "warn",
        text: `Wake check-in is open ${wakeHabit.windowStart}–${wakeHabit.windowEnd}. Come back in that window.`,
      });
      return;
    }
    if (wakeRef.current) return;
    const t = nowHHMM();
    const next = { ...checksRef.current, wakeEarly: true };
    setWakeTime(t);
    setChecks(next);
    await persist(next, t, bedRef.current);
    if (morningFlow !== "done") {
      await fetch("/api/mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "morning-flow", step: "reminders" }),
      });
      setMorningFlow("reminders");
      setShowAfterWake(true);
    }
  }

  async function goingToSleep() {
    const sleepHabit = defsRef.current.find((h) => h.key === "sleepEarly");
    if (sleepHabit && !sleepHabit.canSubmit) {
      setBanner({
        tone: "tip",
        text: `Sleep check-in opens ${sleepHabit.windowStart}–${sleepHabit.windowEnd}.`,
      });
      return;
    }
    if (bedRef.current) return;
    const t = nowHHMM();
    const next = { ...checksRef.current, sleepEarly: true };
    setBedtime(t);
    setChecks(next);
    await persist(next, wakeRef.current, t);
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
        text: `You’re in. ${days}-day challenge started — show up tomorrow morning.`,
      });
      await load();
    } else {
      setBanner({
        tone: "error",
        text: "Couldn’t start the challenge. Try again.",
      });
    }
  }

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setBanner({
        tone: "warn",
        text: "This browser doesn’t support notifications.",
      });
      return;
    }
    const p = await Notification.requestPermission();
    setNotifyReady(p === "granted");
    setBanner({
      tone: p === "granted" ? "success" : "tip",
      text:
        p === "granted"
          ? "Notifications on — Dawn can nudge you at reminder times."
          : "Notifications stayed off. You can turn them on later in Settings.",
    });
  }

  async function toggleTodo(t: Todo) {
    await fetch("/api/day-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, done: !t.done }),
    });
    setTodayTodos((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x))
    );
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 py-10">
        <div className="h-3 w-28 rounded bg-white/10" />
        <div className="h-10 w-3/4 max-w-sm rounded bg-white/10" />
        <div className="h-4 w-full max-w-md rounded bg-white/5" />
        <p className="pt-4 text-sm text-[var(--color-mist)]">Loading today…</p>
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

  const done = habitDefs.filter((h) => checks[h.key]).length;
  const openNow = habitDefs.filter((h) => h.canSubmit && !checks[h.key]);
  const focusKey = profile?.focusHabitKey || "wakeEarly";
  const sortedHabits = [...habitDefs].sort((a, b) => {
    const aM = missionKeys.includes(a.key) ? 1 : 0;
    const bM = missionKeys.includes(b.key) ? 1 : 0;
    if (aM !== bM) return bM - aM;
    if (a.canSubmit !== b.canSubmit) return a.canSubmit ? -1 : 1;
    if (a.key === focusKey) return -1;
    if (b.key === focusKey) return 1;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });

  const wakeHabit = habitDefs.find((h) => h.key === "wakeEarly");
  const wakeWindowOpen = Boolean(wakeHabit?.canSubmit);
  const showAfter =
    Boolean(wakeTime) && showAfterWake && morningFlow !== "done";

  let actionLabel = "Today";
  let actionHelp = "";
  if (!wakeTime && wakeWindowOpen) {
    actionLabel = "Wake check-in";
    actionHelp = "Hold the button to log that you’re up.";
  } else if (!wakeTime && !wakeWindowOpen) {
    actionLabel = "Wake window closed";
    actionHelp = `Open ${wakeHabit?.windowStart || "—"}–${wakeHabit?.windowEnd || "—"}.`;
  } else if (showAfter && morningFlow !== "todos") {
    actionLabel = "Reminders";
    actionHelp = "Optional — add one or skip.";
  } else if (showAfter) {
    actionLabel = "Tasks";
    actionHelp = "Optional — add a few or skip.";
  } else if (dayMode === "evening" || dayMode === "night") {
    actionLabel = "Evening";
    actionHelp = "Finish habits, then plan tomorrow.";
  } else if (wakeTime) {
    actionLabel = openNow.length ? "Open habits" : "Habits";
    actionHelp = openNow.length
      ? "Tap a habit to mark it done."
      : "Nothing open right now — come back later.";
  }

  return (
    <div className="animate-rise space-y-6 sm:space-y-7">
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

      <header>
        <p className="ui-kicker">Today</p>
        <h1 className="font-display mt-2 text-3xl text-white sm:text-4xl">
          {friendlyDate(today) || "Your day"}
        </h1>
        <p className="mt-1.5 text-sm text-[var(--color-mist)]">
          {wakeTime ? `Up at ${wakeTime}` : `Wake goal ${wakeGoal}`}
          {todayPlan?.goalText ? ` · ${todayPlan.goalText}` : ""}
        </p>
      </header>

      <TodayOverview
        earlyStreak={profile?.earlyStreak || 0}
        openStreak={profile?.openStreak || 0}
        habitsDone={done}
        habitsTotal={habitDefs.length || 1}
        challenge={challenge}
        onStartChallenge={(days) => void startChallenge(days)}
      />

      {banner ? <UiMessage tone={banner.tone}>{banner.text}</UiMessage> : null}

      <section className="ui-card space-y-4">
        <div>
          <p className="ui-card-label">{actionLabel}</p>
          {actionHelp ? <p className="ui-section-help">{actionHelp}</p> : null}
        </div>

        {!wakeTime ? (
          <MorningRitual
            pledge={profile?.pledgeText}
            whyLine={undefined}
            challengeDay={undefined}
            challengeTotal={challenge?.total || 7}
            planGoal={undefined}
            planWake={todayPlan?.wakeGoal || wakeGoal}
            disabled={saving || !wakeWindowOpen}
            alreadyUp={false}
            windowOpen={wakeWindowOpen}
            windowStart={wakeHabit?.windowStart}
            windowEnd={wakeHabit?.windowEnd}
            opensInMin={wakeHabit?.opensInMin}
            onRise={() => void wokeUp()}
          />
        ) : null}

        <MorningAfterWake
          open={showAfter}
          initialStep={morningFlow === "todos" ? "todos" : "reminders"}
          onDone={() => {
            setShowAfterWake(false);
            setMorningFlow("done");
            setBanner({
              tone: "success",
              text: "Morning set. Mark habits when they open.",
            });
            void load();
          }}
        />

        {wakeTime && !showAfter ? (
          <div className="space-y-6">
            {todayTodos.length > 0 ? (
              <div>
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <p className="ui-section-title">Tasks</p>
                  <p className="text-xs text-[var(--color-mist)]">
                    {todayTodos.filter((t) => t.done).length}/{todayTodos.length}
                  </p>
                </div>
                <ul className="space-y-2">
                  {todayTodos.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => void toggleTodo(t)}
                        className={`ui-row ${t.done ? "is-done" : ""}`}
                      >
                        <span className={`ui-check ${t.done ? "is-on" : ""}`}>
                          ✓
                        </span>
                        <span
                          className={`text-sm ${
                            t.done
                              ? "text-[var(--color-mist)] line-through"
                              : "text-white"
                          }`}
                        >
                          {t.text}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <p className="ui-section-title">Habits</p>
                <Link
                  href="/settings?tab=habits"
                  className="ui-btn-text shrink-0 text-xs"
                >
                  Edit
                </Link>
              </div>
              <ul className="space-y-2">
                {sortedHabits.map((h) => {
                  const isDone = Boolean(checks[h.key]);
                  const locked = !isDone && !h.canSubmit;
                  return (
                    <li key={h.key}>
                      <button
                        type="button"
                        onClick={() => void toggleHabit(h)}
                        disabled={saving}
                        className={`ui-row ${isDone ? "is-done" : ""} ${
                          locked ? "is-locked" : ""
                        }`}
                      >
                        <span className={`ui-check ${isDone ? "is-on" : ""}`}>
                          ✓
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-white">
                            {h.label}
                          </span>
                          <span className="mt-0.5 block text-xs text-[var(--color-mist)]">
                            {locked
                              ? h.opensInMin
                                ? `Opens in ${formatDuration(h.opensInMin)}`
                                : `From ${h.windowStart || "—"}`
                              : isDone
                                ? "Done"
                                : `Open · until ${h.windowEnd}`}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {(dayMode === "evening" || dayMode === "night" || bedtime) && (
              <CloseDayPanel
                sleepGoal={sleepGoal}
                wakeGoal={wakeGoal}
                bedtimeLogged={Boolean(bedtime)}
                onSleepNow={() => void goingToSleep()}
                onSaved={() => void load()}
              />
            )}
          </div>
        ) : null}
      </section>

      {!notifyReady && !wakeTime ? (
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
  );
}
