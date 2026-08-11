"use client";

import { useSession } from "next-auth/react";
import { AppNav } from "@/components/AppNav";
import { TodayCheckIn } from "@/components/TodayCheckIn";

export function DashboardClient() {
  const { data: session, status } = useSession();

  if (status === "loading" || !session?.user) {
    return (
      <main className="dawn-bg flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-display text-2xl text-[var(--color-dawn)]">Dawn</p>
        <p className="text-sm text-[var(--color-mist)]">
          {status === "loading"
            ? "Opening your morning…"
            : "Sign in to see today."}
        </p>
      </main>
    );
  }

  return (
    <main className="dawn-bg noise relative min-h-screen">
      <div className="app-shell relative z-10 mx-auto max-w-xl">
        <AppNav active="dashboard" />
        <div className="mt-6 animate-rise sm:mt-10">
          <TodayCheckIn
            wakeGoal={session.user.wakeGoal}
            sleepGoal={session.user.sleepGoal}
          />
        </div>
      </div>
    </main>
  );
}
