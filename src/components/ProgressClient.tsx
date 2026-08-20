"use client";

import { useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import {
  ProgressDetail,
  type ReportTodo,
  type TodoStat,
} from "@/components/ProgressDetail";
import type { HabitDef, HabitLogLike } from "@/lib/habits";
import type { StudyStats } from "@/components/StudyStatusPanel";
import type { ReportRange } from "@/lib/progress-brief";
import type { MissionPublic } from "@/lib/missions";

export function ProgressClient() {
  const [logs, setLogs] = useState<HabitLogLike[]>([]);
  const [habits, setHabits] = useState<HabitDef[]>([]);
  const [todoStats, setTodoStats] = useState<TodoStat[]>([]);
  const [todayTodos, setTodayTodos] = useState<ReportTodo[]>([]);
  const [study, setStudy] = useState<StudyStats | null>(null);
  const [missions, setMissions] = useState<MissionPublic[]>([]);
  const [missionHistory, setMissionHistory] = useState<MissionPublic[]>([]);
  const [missionToday, setMissionToday] = useState("");
  const [range, setRange] = useState<ReportRange>("week");
  const [loading, setLoading] = useState(true);
  const [readyDays, setReadyDays] = useState(0);

  useEffect(() => {
    const days = range === "year" ? 365 : 42;
    if (readyDays >= days) return;
    let cancelled = false;
    if (readyDays === 0) setLoading(true);
    void Promise.all([
      fetch(`/api/habits?days=${days}`).then((r) => r.json()),
      fetch(`/api/study?days=${days}`, { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : null
      ),
      readyDays === 0
        ? fetch("/api/mission").then((r) => (r.ok ? r.json() : null))
        : Promise.resolve(null),
    ])
      .then(([d, s, m]: [
        {
          logs?: HabitLogLike[];
          habits?: HabitDef[];
          todoStats?: TodoStat[];
          todayTodos?: ReportTodo[];
        },
        StudyStats | null,
        {
          missions?: MissionPublic[];
          history?: MissionPublic[];
          today?: string;
        } | null,
      ]) => {
        if (cancelled) return;
        setLogs(d.logs || []);
        setHabits(d.habits || []);
        setTodoStats(d.todoStats || []);
        setTodayTodos(d.todayTodos || []);
        if (s?.status) setStudy(s);
        if (m) {
          setMissions(m.missions || []);
          setMissionHistory(m.history || []);
          if (typeof m.today === "string") setMissionToday(m.today);
        }
        setReadyDays(days);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, readyDays]);

  return (
    <main className="dawn-bg relative min-h-screen">
      <div className="app-shell relative z-10 mx-auto w-full max-w-xl md:mx-0 md:max-w-none">
        <AppNav active="progress" />
        <div className="app-page-wide mt-8 animate-rise">
          <p className="ui-kicker">Progress</p>
          <h1 className="ui-title mt-2">How you’re doing</h1>
          <p className="ui-sub mt-3 max-w-xl">
            Pick a window. You’ll see what you finished, what you missed, and
            one next step. Study time is from Discord rooms or a session you
            start on Today — including a 24-hour cycle of when you sit down.
          </p>
          {loading ? (
            <p className="mt-12 text-[var(--color-mist)]">Reading your days…</p>
          ) : logs.length === 0 &&
            todoStats.length === 0 &&
            missions.length === 0 &&
            !(study?.hourly?.length || study?.weekMinutes || study?.today?.minutes) ? (
            <div className="mt-8 space-y-6">
              <p className="max-w-md text-[var(--color-mist)]">
                Nothing to score yet. Go to{" "}
                <a href="/dashboard" className="ui-btn-text">
                  Today
                </a>
                , log your wake, and close one habit. After a few days this page
                will show what you finish, what you miss, and which weekday is
                weakest.
              </p>
            </div>
          ) : (
            <div className="mt-8">
              <ProgressDetail
                logs={logs}
                habits={habits}
                todoStats={todoStats}
                study={study}
                todayTodos={todayTodos}
                range={range}
                onRange={setRange}
                missions={missions}
                missionHistory={missionHistory}
                missionToday={missionToday}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
