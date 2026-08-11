import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDefaultHabits } from "@/lib/ensure-habits";
import { DEFAULT_HABITS, slugifyHabitKey } from "@/lib/habits";
import { mapCelebrate, type OnboardingAnswers } from "@/lib/onboarding";
import { formatLocalDate } from "@/lib/habits";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      onboardingDone: true,
      onboardingJson: true,
      focusHabitKey: true,
      identityLine: true,
      whyLine: true,
      xp: true,
      level: true,
      wakeGoal: true,
      sleepGoal: true,
    },
  });
  return NextResponse.json({ user });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as Partial<OnboardingAnswers> & {
    whyRaw?: string;
    celebrateRaw?: string;
  };

  const wakeGoal =
    body.wakeGoal && /^\d{2}:\d{2}$/.test(body.wakeGoal)
      ? body.wakeGoal
      : "06:00";
  const sleepGoal =
    body.sleepGoal && /^\d{2}:\d{2}$/.test(body.sleepGoal)
      ? body.sleepGoal
      : "22:30";

  let focusKey = String(body.focusHabitKey || "wakeEarly");
  let focusLabel = String(body.focusLabel || "Wake early");
  if (focusKey === "custom") {
    const custom = String(body.focusCustom || body.focusLabel || "My first habit")
      .trim()
      .slice(0, 60);
    focusLabel = custom || "My first habit";
    focusKey = slugifyHabitKey(focusLabel);
  }

  const why =
    String(body.whyCustom || body.why || body.whyRaw || "")
      .replace(/^Other.*/i, "")
      .trim() || String(body.why || "Own my mornings");

  const identity = String(body.identity || "wakes early and owns the first hour")
    .trim()
    .slice(0, 120);

  const celebrate = mapCelebrate(
    String(body.celebrate || body.celebrateRaw || "big")
  );

  const answers: OnboardingAnswers = {
    why,
    currentWake: String(body.currentWake || "08:00"),
    wakeGoal,
    sleepGoal,
    friction: String(body.friction || ""),
    focusHabitKey: focusKey,
    focusLabel,
    focusCustom: body.focusCustom,
    identity,
    celebrate,
  };

  // Habits: keep core stack, emphasize focus
  await ensureDefaultHabits(session.user.id);

  // Ensure focus habit exists
  const known = DEFAULT_HABITS.find((h) => h.key === focusKey);
  const existing = await prisma.habit.findUnique({
    where: {
      userId_key: { userId: session.user.id, key: focusKey },
    },
  });
  if (!existing) {
    const maxSort = await prisma.habit.aggregate({
      where: { userId: session.user.id },
      _max: { sortOrder: true },
    });
    await prisma.habit.create({
      data: {
        userId: session.user.id,
        key: focusKey,
        label: known?.label || focusLabel,
        description: known?.description || "Your 14-day focus habit",
        sortOrder: known?.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
        isDefault: Boolean(known),
        active: true,
      },
    });
  } else if (!existing.active) {
    await prisma.habit.update({
      where: { id: existing.id },
      data: { active: true, label: focusLabel },
    });
  }

  // Always keep wake early + sleep early active
  for (const key of ["wakeEarly", "sleepEarly"] as const) {
    await prisma.habit.updateMany({
      where: { userId: session.user.id, key },
      data: { active: true },
    });
  }

  // Goals
  const goalCount = await prisma.goal.count({
    where: { userId: session.user.id },
  });
  if (goalCount === 0) {
    await prisma.goal.createMany({
      data: [
        {
          userId: session.user.id,
          title: "Wake early",
          description: why.slice(0, 160),
          targetTime: wakeGoal,
          kind: "wake",
        },
        {
          userId: session.user.id,
          title: "Sleep early",
          description: "Protect the night so mornings work",
          targetTime: sleepGoal,
          kind: "sleep",
        },
        {
          userId: session.user.id,
          title: focusLabel,
          description: "14-day focus habit",
          targetTime: focusKey === "wakeEarly" ? wakeGoal : null,
          kind: "custom",
        },
      ],
    });
  }

  // Reminders: wake + sleep + focus ping
  const remCount = await prisma.reminder.count({
    where: { userId: session.user.id },
  });
  if (remCount === 0) {
    await prisma.reminder.createMany({
      data: [
        {
          userId: session.user.id,
          title: "Dawn hit — wake check-in",
          message: `Hold to rise in Dawn. You said: ${why.slice(0, 80)}`,
          time: wakeGoal,
          enabled: true,
          notifyBrowser: true,
          notifyDiscord: false,
        },
        {
          userId: session.user.id,
          title: "Close the day",
          message: "Open Dawn → set tomorrow → then sleep. Protect the streak.",
          time: sleepGoal,
          enabled: true,
          notifyBrowser: true,
          notifyDiscord: false,
        },
      ],
    });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      onboardingDone: true,
      onboardingJson: JSON.stringify(answers),
      focusHabitKey: focusKey,
      identityLine: identity,
      whyLine: why.slice(0, 240),
      wakeGoal,
      sleepGoal,
      challengeStartDate: formatLocalDate(new Date()),
      pledgeText: `I wake by ${wakeGoal} because ${why.slice(0, 100)}`.slice(
        0,
        200
      ),
      lastOpenDate: formatLocalDate(new Date()),
      openStreak: 1,
      bestOpenStreak: 1,
    },
  });

  return NextResponse.json({
    ok: true,
    user: {
      onboardingDone: user.onboardingDone,
      focusHabitKey: user.focusHabitKey,
      identityLine: user.identityLine,
      whyLine: user.whyLine,
      wakeGoal: user.wakeGoal,
      sleepGoal: user.sleepGoal,
      celebrate,
    },
  });
}
