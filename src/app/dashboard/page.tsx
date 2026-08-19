import { DashboardClient } from "@/components/DashboardClient";
import { enrollDiscordFriend } from "@/lib/discord-enroll";
import { requireAppSession } from "@/lib/require-app-session";

export default async function DashboardPage() {
  const session = await requireAppSession();

  if (session.user.discordId) {
    void enrollDiscordFriend({
      userId: session.user.id,
      discordId: session.user.discordId,
    }).catch(() => undefined);
  }

  return (
    <DashboardClient
      wakeGoal={session.user.wakeGoal || "06:00"}
      sleepGoal={session.user.sleepGoal || "23:00"}
    />
  );
}
