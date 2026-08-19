import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Logged-in app session. Skips a second user query when onboarding is already known. */
export async function requireAppSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!session.user.onboardingDone) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboardingDone: true },
    });
    if (!user?.onboardingDone) redirect("/onboarding");
  }
  return session;
}
