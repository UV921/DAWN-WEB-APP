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
          <p className="text-sm uppercase tracking-[0.22em] text-[var(--color-dawn)]">
            Progress
          </p>
          <h1 className="font-display mt-2 text-4xl text-white md:text-5xl">
            Your grid
          </h1>
          <p className="mt-3 max-w-lg text-[var(--color-mist)]">
            Contribution graph and wake times — the long view of consistency.
          </p>
          {loading ? (
            <p className="mt-12 text-[var(--color-mist)]">Loading charts…</p>
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
