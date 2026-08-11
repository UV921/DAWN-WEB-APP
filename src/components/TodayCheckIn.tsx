"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HabitDef, HabitLogLike } from "@/lib/habits";
import type { DayMode } from "@/lib/daily-loop";
import { formatDuration } from "@/lib/habit-windows";
import { WakeHit } from "@/components/WakeHit";
import { MorningRitual } from "@/components/MorningRitual";
import { MorningAfterWake } from "@/components/MorningAfterWake";
import { MissionSetup } from "@/components/MissionSetup";
import { CloseDayPanel } from "@/components/CloseDayPanel";
import { ChallengeStrip } from "@/components/ChallengeStrip";
import { FlowSteps, IconChevronRight, IconSettings } from "@/components/icons";

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

export function TodayCheckIn({ wakeGoal, sleepGoal, onData }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [today, setToday] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [bedtime, setBedtime] = useState("");
  const [habitDefs, setHabitDefs] = useState<HabitRow[]>([]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [streaks, setStreaks] = useState<Streaks>({});
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [banner, setBanner] = useState("");
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
  const [hasMission, setHasMission] = useState(false);
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
    const [res, missionRes] = await Promise.all([
      fetch("/api/habits?days=400"),
      fetch("/api/mission"),
    ]);
    if (!res.ok) {
      setLoading(false);
      return;
    }
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
      setHasMission(Boolean(m.mission?.progress?.active));
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
    setLoading(false);
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
      setBanner("");
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
        setBanner("Could not save.");
        return;
      }
      const saved = await res.json();
      if (saved.rejected?.length) {
        setBanner(
          (saved.rejected as { reason: string }[])
            .map((r) => r.reason)
            .slice(0, 2)
            .join(" · ")
        );
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
      window.setTimeout(() => setStatus("idle"), 1200);
    },
    [load]
  );

  async function toggleHabit(h: HabitRow) {
    const done = checksRef.current[h.key];
    if (!done && !h.canSubmit) {
      setBanner(
        h.opensInMin
          ? `${h.label} opens in ${formatDuration(h.opensInMin)} (${h.windowStart}–${h.windowEnd})`
          : `${h.label}: ${h.windowLabel || "outside window"}`
      );
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
      setBanner(
        `Wake opens ${wakeHabit.windowStart}–${wakeHabit.windowEnd}. Come back then.`
      );
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
      setBanner(
        `Sleep window ${sleepHabit.windowStart}–${sleepHabit.windowEnd}.`
      );
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
    if (res.ok) await load();
  }

  async function enableNotifications() {
    if (!("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setNotifyReady(p === "granted");
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
      <div className="animate-pulse py-12 text-[var(--color-mist)]">
        Loading today…
      </div>
    );
  }

  const done = habitDefs.filter((h) => checks[h.key]).length;
  const streak = streaks.perfect?.current ?? 0;
  const focusKey = profile?.focusHabitKey || "wakeEarly";
  const openNow = habitDefs.filter((h) => h.canSubmit && !checks[h.key]);
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
  const showMorningRitual = !wakeTime;
  const showEvening =
    dayMode === "evening" || dayMode === "night" || Boolean(wakeTime);

  const modeCopy =
    dayMode === "morning" && wakeWindowOpen
      ? null
      : dayMode === "evening"
        ? "Close the day before bed."
        : dayMode === "night"
          ? "Protect sleep."
          : wakeTime
            ? "Clear what’s open."
            : `Ask time ${wakeHabit?.windowStart || "—"}–${wakeHabit?.windowEnd || "—"}.`;

  const challengeActive = Boolean(challenge?.active);

  return (
    <div className="animate-rise space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-5">
        <div className="min-w-0">
          {profile?.identityLine ? (
            <p className="font-display text-xl text-white sm:text-2xl">
              I am someone who {profile.identityLine}
            </p>
          ) : (
            <p className="text-sm text-[var(--color-mist)]">
              Set your name &amp; lines in{" "}
              <a
                href="/settings?tab=you"
                className="inline-flex items-center gap-1 text-white underline-offset-2 hover:underline"
              >
                <IconSettings size={14} />
                Settings
                <IconChevronRight size={14} />
                You
              </a>
            </p>
          )}
          {profile?.whyLine ? (
            <p className="mt-1 text-sm text-[var(--color-mist)]">
              {profile.whyLine}
            </p>
          ) : null}
        </div>
        <div className="text-right text-sm">
          <p className="text-[var(--color-leaf)]">
            {profile?.earlyStreak || 0}d early
          </p>
          <p className="text-[var(--color-mist)]">
            {done}/{habitDefs.length || 1} habits · streak {streak}
          </p>
        </div>
      </div>

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

      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--color-mist)]">
          {today}
        </p>
        <h2 className="font-display mt-2 text-3xl text-white md:text-4xl">
          {dayMode === "morning" && wakeWindowOpen
            ? "Are you awake?"
            : dayMode === "evening"
              ? "Close the day"
              : wakeTime
                ? "Today’s habits"
                : "Wake window later"}
        </h2>
        <p className="mt-2 max-w-md text-sm text-[var(--color-mist)]">
          {dayMode === "morning" && wakeWindowOpen ? (
            <FlowSteps steps={["Hold yes", "Reminders", "Today’s tasks"]} />
          ) : (
            modeCopy
          )}
        </p>
      </div>

      {banner ? (
        <p className="rounded-xl border border-[var(--color-ember)]/40 bg-[var(--color-ember)]/10 px-4 py-3 text-sm text-[var(--color-cloud)]">
          {banner}
        </p>
      ) : null}

      {!notifyReady ? (
        <button
          type="button"
          onClick={() => void enableNotifications()}
          className="text-left text-sm text-[var(--color-mist)] underline-offset-2 hover:text-white hover:underline"
        >
          Enable device wake ping
        </button>
      ) : null}

      {showMorningRitual ? (
        <MorningRitual
          pledge={profile?.pledgeText}
          whyLine={profile?.whyLine}
          challengeDay={challengeActive ? challenge?.day : undefined}
          challengeTotal={challenge?.total || 7}
          planGoal={todayPlan?.goalText}
          planWake={todayPlan?.wakeGoal || wakeGoal}
          disabled={saving || !wakeWindowOpen}
          alreadyUp={Boolean(wakeTime)}
          windowOpen={wakeWindowOpen}
          windowStart={wakeHabit?.windowStart}
          windowEnd={wakeHabit?.windowEnd}
          opensInMin={wakeHabit?.opensInMin}
          onRise={() => void wokeUp()}
        />
      ) : wakeTime ? (
        <MorningRitual
          alreadyUp
          windowOpen={false}
          onRise={() => undefined}
          pledge={profile?.pledgeText}
        />
      ) : null}

      <MorningAfterWake
        open={Boolean(wakeTime) && showAfterWake && morningFlow !== "done"}
        initialStep={morningFlow === "todos" ? "todos" : "reminders"}
        onDone={() => {
          setShowAfterWake(false);
          setMorningFlow("done");
          void load();
        }}
      />

      {todayTodos.length > 0 && wakeTime ? (
        <section className="space-y-3">
          <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-mist)]">
            Today’s tasks
          </p>
          {todayPlan?.goalText ? (
            <p className="text-white">{todayPlan.goalText}</p>
          ) : null}
          <ul className="space-y-2">
            {todayTodos.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => void toggleTodo(t)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm ${
                    t.done
                      ? "border-[var(--color-dawn)]/40 text-[var(--color-mist)] line-through"
                      : "border-white/10 text-white"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                      t.done
                        ? "border-[var(--color-dawn)] bg-[var(--color-dawn)] text-[var(--color-night)]"
                        : "border-white/30"
                    }`}
                  >
                    ✓
                  </span>
                  {t.text}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {openNow.length > 0 ? (
        <p className="text-sm text-[var(--color-leaf)]">
          Open now: {openNow.map((h) => h.label).join(" · ")}
        </p>
      ) : null}

      <ul className="space-y-2">
        {sortedHabits.map((h) => {
          const isFocus = h.key === focusKey;
          const inMission = missionKeys.includes(h.key);
          const isDone = Boolean(checks[h.key]);
          const locked = !isDone && !h.canSubmit;
          return (
            <li key={h.key}>
              <button
                type="button"
                onClick={() => void toggleHabit(h)}
                disabled={saving}
                className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                  isDone
                    ? "border-[var(--color-dawn)]/50 bg-[var(--color-dawn)]/10"
                    : locked
                      ? "border-white/5 bg-white/[0.02] opacity-60"
                      : inMission || isFocus
                        ? "border-[var(--color-dawn)]/35 bg-[var(--color-dawn)]/[0.06] hover:border-[var(--color-dawn)]"
                        : "border-white/10 bg-white/[0.03] hover:border-white/25"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                    isDone
                      ? "border-[var(--color-dawn)] bg-[var(--color-dawn)] text-[var(--color-night)]"
                      : "border-white/30 text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-white">{h.label}</span>
                    {inMission ? (
                      <span className="text-[10px] uppercase tracking-wider text-[var(--color-dawn)]">
                        mission
                      </span>
                    ) : null}
                    {locked ? (
                      <span className="text-[10px] uppercase tracking-wider text-[var(--color-mist)]">
                        locked
                      </span>
                    ) : !isDone && h.canSubmit ? (
                      <span className="text-[10px] uppercase tracking-wider text-[var(--color-leaf)]">
                        open
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block font-mono text-xs text-[var(--color-mist)]">
                    {h.windowStart}–{h.windowEnd}
                    {h.canSubmit && h.closesInMin
                      ? ` · closes in ${formatDuration(h.closesInMin)}`
                      : ""}
                    {!h.canSubmit && h.opensInMin
                      ? ` · opens in ${formatDuration(h.opensInMin)}`
                      : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {hasMission ? (
        <MissionSetup compact onStarted={() => void load()} />
      ) : (
        <a
          href="/settings?tab=mission"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-mist)] underline-offset-2 hover:text-white hover:underline"
        >
          Start a mission in Settings
          <IconChevronRight size={14} />
        </a>
      )}

      {challengeActive ? (
        <ChallengeStrip
          day={challenge?.day || 0}
          total={challenge?.total || 7}
          daysLeft={challenge?.daysLeft || 7}
          active
          ended={false}
          openStreak={profile?.openStreak || 0}
          earlyStreak={profile?.earlyStreak || 0}
          focusLabel={
            habitDefs.find((h) => h.key === focusKey)?.label || undefined
          }
          onStart={(days) => void startChallenge(days)}
        />
      ) : (
        <details className="rounded-2xl border border-white/10 px-4 py-3">
          <summary className="cursor-pointer text-sm text-[var(--color-mist)]">
            Start a wake challenge (pick days)
          </summary>
          <div className="mt-3">
            <ChallengeStrip
              day={0}
              total={7}
              daysLeft={7}
              active={false}
              ended={Boolean(challenge?.ended)}
              openStreak={profile?.openStreak || 0}
              earlyStreak={profile?.earlyStreak || 0}
              onStart={(days) => void startChallenge(days)}
            />
          </div>
        </details>
      )}

      {showEvening ? (
        <CloseDayPanel
          sleepGoal={sleepGoal}
          wakeGoal={wakeGoal}
          bedtimeLogged={Boolean(bedtime)}
          onSleepNow={() => void goingToSleep()}
          onSaved={() => void load()}
        />
      ) : null}

      <p className="text-xs text-[var(--color-mist)]">
        {saving
          ? "Saving…"
          : status === "saved"
            ? "Saved"
            : status === "error"
              ? "Error"
              : ""}
      </p>
    </div>
  );
}
