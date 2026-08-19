import { LeaderboardClient } from "@/components/LeaderboardClient";
import { requireAppSession } from "@/lib/require-app-session";

export default async function LeaderboardPage() {
  await requireAppSession();
  return <LeaderboardClient />;
}
