import { SleepClient } from "@/components/SleepClient";
import { requireAppSession } from "@/lib/require-app-session";

export default async function SleepPage() {
  const session = await requireAppSession();
  return (
    <SleepClient
      wakeGoal={session.user.wakeGoal || "06:00"}
      sleepGoal={session.user.sleepGoal || "23:00"}
    />
  );
}
