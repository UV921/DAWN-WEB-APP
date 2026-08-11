import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatLocalDate } from "@/lib/habits";
import { challengeProgress } from "@/lib/daily-loop";

function clampDays(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return 7;
  return Math.min(90, Math.max(3, n));
}

/** Start or restart a wake challenge with a user-selected length. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const today = formatLocalDate(new Date());
  const days = clampDays(body.days);
  const userRow = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { whyLine: true, wakeGoal: true, pledgeText: true },
  });

  const pledge =
    typeof body.pledgeText === "string" && body.pledgeText.trim()
      ? body.pledgeText.trim().slice(0, 200)
      : userRow?.pledgeText ||
        `I wake by ${userRow?.wakeGoal || "06:00"}${
          userRow?.whyLine ? ` because ${userRow.whyLine.slice(0, 80)}` : ""
        }`;

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      challengeStartDate: today,
      challengeDays: days,
      pledgeText: pledge,
    },
  });

  return NextResponse.json({
    challenge: challengeProgress(
      user.challengeStartDate,
      today,
      user.challengeDays
    ),
    pledgeText: user.pledgeText,
  });
}
