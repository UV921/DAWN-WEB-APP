import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "@/components/DashboardClient";
import { enrollDiscordFriend } from "@/lib/discord-enroll";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingDone: true, discordId: true },
  });
  if (!user?.onboardingDone) redirect("/onboarding");

  if (user.discordId) {
    void enrollDiscordFriend({
      userId: session.user.id,
      discordId: user.discordId,
    }).catch(() => undefined);
  }

  return (
    <DashboardClient
      wakeGoal={session.user.wakeGoal || "06:00"}
      sleepGoal={session.user.sleepGoal || "23:00"}
    />
  );
}
