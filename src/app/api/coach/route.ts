import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatLocalDate, mergeLogChecks } from "@/lib/habits";
import { generateAiCoach, isAiConfigured, aiProviderLabel } from "@/lib/ai-coach";
import { parseLifeJson } from "@/lib/personal-life";

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
        error:
          "Add GEMINI_API_KEY or OPENAI_API_KEY to .env (Gemini / OpenAI / Groq / OpenRouter / Ollama).",
        configured: false,
      },
      { status: 400 }
    );
  }

  const since = formatLocalDate(
    new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
  );
  const [rawLogs, user] = await Promise.all([
    prisma.habitLog.findMany({
      where: { userId: session.user.id, date: { gte: since } },
      orderBy: { date: "asc" },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { whyLine: true, lifeJson: true, name: true },
    }),
  ]);
  const logs = rawLogs.map((l) => ({
    ...l,
    checks: mergeLogChecks(l),
  }));
  const life = parseLifeJson(user?.lifeJson);

  const result = await generateAiCoach({
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
    coach: result.coach,
    provider: result.provider,
  });
}
