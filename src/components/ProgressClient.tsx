"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AppNav } from "@/components/AppNav";
import { HabitCharts } from "@/components/HabitCharts";
import type { HabitDef, HabitLogLike } from "@/lib/habits";

export function ProgressClient() {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<HabitLogLike[]>([]);
  const [habits, setHabits] = useState<HabitDef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/habits")
      .then((r) => r.json())
      .then((d: { logs?: HabitLogLike[]; habits?: HabitDef[] }) => {
        setLogs(d.logs || []);
        setHabits(d.habits || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (!session?.user) {
    return (
      <main className="dawn-bg flex min-h-screen items-center justify-center text-[var(--color-mist)]">
        Loading…
      </main>
    );
  }

  return (
    <main className="dawn-bg noise relative min-h-screen">
      <div className="app-shell relative z-10 mx-auto max-w-5xl">
        <AppNav active="progress" />
        <div className="mt-10 animate-rise">
          <p className="ui-kicker">Progress</p>
          <h1 className="ui-title mt-2">Your consistency</h1>
          <p className="ui-sub mt-3">
            Heatmap and wake times — proof of the days you showed up. Empty days
            mean you haven’t checked in yet.
          </p>
          {loading ? (
            <p className="mt-12 text-[var(--color-mist)]">Loading your charts…</p>
          ) : logs.length === 0 ? (
            <p className="mt-12 max-w-md text-[var(--color-mist)]">
              No check-ins yet. Complete a morning on{" "}
              <a href="/dashboard" className="ui-btn-text">
                Today
              </a>{" "}
              and your grid will fill in here.
            </p>
          ) : (
            <div className="mt-8">
              <HabitCharts logs={logs} habits={habits} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
