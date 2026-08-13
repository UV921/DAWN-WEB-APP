import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SleepClient } from "@/components/SleepClient";

export default async function SleepPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingDone: true },
  });
  if (!user?.onboardingDone) redirect("/onboarding");

  return (
    <SleepClient
      wakeGoal={session.user.wakeGoal || "06:00"}
      sleepGoal={session.user.sleepGoal || "23:00"}
    />
  );
}
