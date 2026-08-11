"use client";

import { useSession } from "next-auth/react";
import { AppNav } from "@/components/AppNav";
import { TodayCheckIn } from "@/components/TodayCheckIn";
import { FlowSteps } from "@/components/icons";

export function DashboardClient() {
  const { data: session } = useSession();

  if (!session?.user) {
    return (
      <main className="dawn-bg flex min-h-screen items-center justify-center text-[var(--color-mist)]">
        Loading…
      </main>
    );
  }

  const first = session.user.name?.split(" ")[0];

  return (
    <main className="dawn-bg noise relative min-h-screen">
      <div className="app-shell relative z-10 mx-auto max-w-3xl">
        <AppNav active="dashboard" />
        <div className="mt-6 animate-rise sm:mt-10">
          <p className="text-sm uppercase tracking-[0.22em] text-[var(--color-dawn)]">
            Today
          </p>
          <h1 className="font-display mt-2 text-3xl text-white sm:text-4xl md:text-5xl">
            {first ? `${first}` : "Dawn"}
          </h1>
          <p className="mt-3 max-w-lg text-sm text-[var(--color-mist)] sm:text-base">
            <FlowSteps steps={["Awake", "Reminders", "Tasks", "Habits"]} />
          </p>
          <div className="mt-6 sm:mt-8">
            <TodayCheckIn
              wakeGoal={session.user.wakeGoal}
              sleepGoal={session.user.sleepGoal}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
