"use client";

import { useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { HabitCharts } from "@/components/HabitCharts";
import { ProgressDetail } from "@/components/ProgressDetail";
import type { HabitDef, HabitLogLike } from "@/lib/habits";
import type { TodoStat } from "@/components/ProgressDetail";

export function ProgressClient() {
  const [logs, setLogs] = useState<HabitLogLike[]>([]);
  const [habits, setHabits] = useState<HabitDef[]>([]);
  const [todoStats, setTodoStats] = useState<TodoStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/habits?days=90")
      .then((r) => r.json())
      .then((d: { logs?: HabitLogLike[]; habits?: HabitDef[]; todoStats?: TodoStat[] }) => {
        setLogs(d.logs || []);
        setHabits(d.habits || []);
        setTodoStats(d.todoStats || []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="dawn-bg relative min-h-screen">
      <div className="app-shell relative z-10 mx-auto max-w-5xl">
        <AppNav active="progress" />
        <div className="mt-8">
          <p className="ui-kicker">Progress</p>
          <h1 className="ui-title mt-2">Your consistency</h1>
          <p className="ui-sub mt-3">
            Habit %, task %, weekday more/less, sleep hours, and the heatmap of
            showing up.
          </p>
          {loading ? (
            <p className="mt-12 text-[var(--color-mist)]">Loading charts…</p>
          ) : logs.length === 0 && todoStats.length === 0 ? (
            <p className="mt-12 max-w-md text-[var(--color-mist)]">
              No check-ins yet. Complete a morning on{" "}
              <a href="/dashboard" className="ui-btn-text">
                Today
              </a>
              .
            </p>
          ) : (
            <div className="mt-8 space-y-12">
              <ProgressDetail logs={logs} habits={habits} todoStats={todoStats} />
              {logs.length > 0 ? (
                <HabitCharts logs={logs} habits={habits} />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
