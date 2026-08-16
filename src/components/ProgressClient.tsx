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

export function ProgressClient() {
  const [logs, setLogs] = useState<HabitLogLike[]>([]);
  const [habits, setHabits] = useState<HabitDef[]>([]);
  const [todoStats, setTodoStats] = useState<TodoStat[]>([]);
  const [todayTodos, setTodayTodos] = useState<ReportTodo[]>([]);
  const [study, setStudy] = useState<StudyStats | null>(null);
  const [range, setRange] = useState<ReportRange>("week");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([
      fetch("/api/habits?days=365").then((r) => r.json()),
      fetch("/api/study?days=365").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([d, s]: [
        {
          logs?: HabitLogLike[];
          habits?: HabitDef[];
          todoStats?: TodoStat[];
          todayTodos?: ReportTodo[];
        },
        StudyStats | null,
      ]) => {
        setLogs(d.logs || []);
        setHabits(d.habits || []);
        setTodoStats(d.todoStats || []);
        setTodayTodos(d.todayTodos || []);
        if (s?.status) setStudy(s);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="dawn-bg relative min-h-screen">
      <div className="app-shell relative z-10 mx-auto w-full max-w-xl md:mx-0 md:max-w-none">
        <AppNav active="progress" />
        <div className="mt-8">
          <p className="ui-kicker">Progress</p>
          <h1 className="ui-title mt-2">How you’re doing</h1>
          <p className="ui-sub mt-3 max-w-xl">
            Pick a window. You’ll see what you finished, what you missed, and
            one next step. Study time is from Discord rooms (last 30 days).
          </p>
          {loading ? (
            <p className="mt-12 text-[var(--color-mist)]">Reading your days…</p>
          ) : logs.length === 0 && todoStats.length === 0 ? (
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
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
