import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatLocalDate, mergeLogChecks } from "@/lib/habits";
import {
  generateTonightPlan,
  isAiConfigured,
  aiProviderLabel,
} from "@/lib/ai-coach";
import { parseLifeJson } from "@/lib/personal-life";

/** Meaningful AI: suggest tomorrow from real wake/habit history. */
export async function GET() {
  return NextResponse.json({
    configured: isAiConfigured(),
    provider: isAiConfigured() ? aiProviderLabel() : null,
  });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAiConfigured()) {
    return NextResponse.json(
      {
        error: "Add GEMINI_API_KEY to .env to use AI suggestions.",
        configured: false,
      },
      { status: 400 }
    );
  }

  const since = formatLocalDate(
    new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  );
  const [rawLogs, user] = await Promise.all([
    prisma.habitLog.findMany({
      where: { userId: session.user.id, date: { gte: since } },
      orderBy: { date: "asc" },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { whyLine: true, name: true, lifeJson: true },
    }),
  ]);

  const logs = rawLogs.map((l) => ({
    ...l,
    checks: mergeLogChecks(l),
  }));

  const life = parseLifeJson(user?.lifeJson);
  const result = await generateTonightPlan({
    logs,
    today: formatLocalDate(new Date()),
    sleepGoal: session.user.sleepGoal || "23:00",
    wakeGoal: session.user.wakeGoal || "06:00",
    name: user?.name || session.user.name,
    whyLine: user?.whyLine,
    lifeAnswers: life.answers,
    lifeBrief: life.brief,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    plan: result.plan,
    provider: result.provider,
  });
}
