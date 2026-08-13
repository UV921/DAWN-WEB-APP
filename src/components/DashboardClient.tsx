"use client";

import { AppNav } from "@/components/AppNav";
import { TodayCheckIn } from "@/components/TodayCheckIn";

type Props = {
  wakeGoal: string;
  sleepGoal: string;
};

export function DashboardClient({ wakeGoal, sleepGoal }: Props) {
  return (
    <main className="dawn-bg relative min-h-screen">
      <div className="app-shell relative z-10 mx-auto max-w-xl">
        <AppNav active="dashboard" />
        <div className="mt-4 sm:mt-8">
          <TodayCheckIn wakeGoal={wakeGoal} sleepGoal={sleepGoal} />
        </div>
      </div>
    </main>
  );
}
