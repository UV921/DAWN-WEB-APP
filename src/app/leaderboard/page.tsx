import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LeaderboardClient } from "@/components/LeaderboardClient";

export default async function LeaderboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingDone: true },
  });
  if (!user?.onboardingDone) redirect("/onboarding");

  return <LeaderboardClient />;
}
