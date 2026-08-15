"use client";

import { useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { HabitCharts } from "@/components/HabitCharts";
import { ProgressDetail } from "@/components/ProgressDetail";
import type { HabitDef, HabitLogLike } from "@/lib/habits";
import type { TodoStat } from "@/components/ProgressDetail";
import type { StudyStats } from "@/components/StudyStatusPanel";
import { StudyStatusPanel } from "@/components/StudyStatusPanel";

export function ProgressClient() {
  const [logs, setLogs] = useState<HabitLogLike[]>([]);
  const [habits, setHabits] = useState<HabitDef[]>([]);
  const [todoStats, setTodoStats] = useState<TodoStat[]>([]);
  const [study, setStudy] = useState<StudyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([
      fetch("/api/habits?days=90").then((r) => r.json()),
      fetch("/api/study?days=30").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([d, s]: [
        { logs?: HabitLogLike[]; habits?: HabitDef[]; todoStats?: TodoStat[] },
        StudyStats | null,
      ]) => {
        setLogs(d.logs || []);
        setHabits(d.habits || []);
        setTodoStats(d.todoStats || []);
        if (s?.status) setStudy(s);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="dawn-bg relative min-h-screen">
      <div className="app-shell relative z-10 mx-auto max-w-5xl">
        <AppNav active="progress" />
        <div className="mt-8">
          <p className="ui-kicker">Progress</p>
          <h1 className="ui-title mt-2">What the week is saying</h1>
          <p className="ui-sub mt-3">
            Not a gallery of charts — a read on mornings, tasks, sleep, and
            study hours. Share a gold card of the week when you want to post it.
          </p>
          {loading ? (
            <p className="mt-12 text-[var(--color-mist)]">Reading your week…</p>
          ) : logs.length === 0 && todoStats.length === 0 ? (
            <div className="mt-8 space-y-6">
              {study?.status ? <StudyStatusPanel data={study} /> : null}
              <p className="max-w-md text-[var(--color-mist)]">
                No morning check-ins yet. Wake and close a habit on{" "}
                <a href="/dashboard" className="ui-btn-text">
                  Today
                </a>{" "}
                — then this page can tell you which weekday leaks.
              </p>
            </div>
          ) : (
            <div className="mt-8 space-y-12">
              <ProgressDetail
                logs={logs}
                habits={habits}
                todoStats={todoStats}
                study={study}
              />
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
