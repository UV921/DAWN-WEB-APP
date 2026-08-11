import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  formatLocalDate,
  isHabitDone,
  mergeLogChecks,
  slugifyHabitKey,
} from "@/lib/habits";
import { challengeProgress } from "@/lib/daily-loop";
import { ensureDefaultHabits } from "@/lib/ensure-habits";

function parseJsonArray(raw: string | null | undefined): string[] {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v)
      ? v.map((x) => String(x).trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = formatLocalDate(new Date());
  const habits = await ensureDefaultHabits(session.user.id);

  const mission = await prisma.mission.findFirst({
    where: { userId: session.user.id, active: true },
    orderBy: { createdAt: "desc" },
  });

  const plan = await prisma.dayPlan.findUnique({
    where: {
      userId_date: { userId: session.user.id, date: today },
    },
  });

  const todos = await prisma.todo.findMany({
    where: { userId: session.user.id, date: today },
    orderBy: { createdAt: "asc" },
  });

  let progress = null;
  let habitStats: {
    key: string;
    label: string;
    doneToday: boolean;
    daysDone: number;
  }[] = [];

  if (mission) {
    progress = challengeProgress(mission.startDate, today, mission.days);
    const keys = parseJsonArray(mission.habitKeys);
    const since = mission.startDate;
    const logs = await prisma.habitLog.findMany({
      where: {
        userId: session.user.id,
        date: { gte: since, lte: today },
      },
    });

    habitStats = keys.map((key) => {
      const label = habits.find((h) => h.key === key)?.label || key;
      const todayLog = logs.find((l) => l.date === today);
      const doneToday = todayLog
        ? isHabitDone({ ...todayLog, checks: mergeLogChecks(todayLog) }, key)
        : false;
      const daysDone = logs.filter((l) =>
        isHabitDone({ ...l, checks: mergeLogChecks(l) }, key)
      ).length;
      return { key, label, doneToday, daysDone };
    });
  }

  return NextResponse.json({
    mission: mission
      ? {
          ...mission,
          habitKeys: parseJsonArray(mission.habitKeys),
          taskTemplates: parseJsonArray(mission.taskTemplates),
          progress,
          habitStats,
        }
      : null,
    habits,
    today,
    morningFlow: plan?.morningFlow || "none",
    todos,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const action = String(body.action || "create");
  const today = formatLocalDate(new Date());

  if (action === "create") {
    const title = String(body.title || "7-day mission").trim().slice(0, 80);
    const days = Math.min(90, Math.max(3, Number(body.days) || 7));
    let habitKeys = Array.isArray(body.habitKeys)
      ? (body.habitKeys as unknown[])
          .map((k) => String(k).trim())
          .filter(Boolean)
          .slice(0, 12)
      : [];
    const taskTemplates = Array.isArray(body.taskTemplates)
      ? (body.taskTemplates as unknown[])
          .map((t) => String(t).trim().slice(0, 120))
          .filter(Boolean)
          .slice(0, 10)
      : [];

    // Custom new habits: [{ label, description? }]
    const newHabits = Array.isArray(body.newHabits)
      ? (body.newHabits as { label?: string; description?: string }[])
      : [];

    await ensureDefaultHabits(session.user.id);

    for (const nh of newHabits) {
      const label = String(nh.label || "").trim().slice(0, 60);
      if (!label) continue;
      const key = slugifyHabitKey(label).slice(0, 40);
      const existing = await prisma.habit.findUnique({
        where: {
          userId_key: { userId: session.user.id, key },
        },
      });
      if (existing) {
        await prisma.habit.update({
          where: { id: existing.id },
          data: {
            active: true,
            label,
            description: String(nh.description || existing.description).slice(
              0,
              160
            ),
          },
        });
      } else {
        const maxSort = await prisma.habit.aggregate({
          where: { userId: session.user.id },
          _max: { sortOrder: true },
        });
        await prisma.habit.create({
          data: {
            userId: session.user.id,
            key,
            label,
            description: String(nh.description || "").slice(0, 160),
            sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
            active: true,
            isDefault: false,
          },
        });
      }
      if (!habitKeys.includes(key)) habitKeys.push(key);
    }

    // Always include wakeEarly as foundation
    if (!habitKeys.includes("wakeEarly")) {
      habitKeys = ["wakeEarly", ...habitKeys];
    }

    // Deactivate previous missions
    await prisma.mission.updateMany({
      where: { userId: session.user.id, active: true },
      data: { active: false },
    });

    // Activate selected habits
    await prisma.habit.updateMany({
      where: { userId: session.user.id, key: { in: habitKeys } },
      data: { active: true },
    });

    const mission = await prisma.mission.create({
      data: {
        userId: session.user.id,
        title: title || "7-day mission",
        startDate: today,
        days,
        active: true,
        habitKeys: JSON.stringify(habitKeys),
        taskTemplates: JSON.stringify(taskTemplates),
      },
    });

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        challengeStartDate: today,
        focusHabitKey: habitKeys[0] || "wakeEarly",
      },
    });

    return NextResponse.json({
      mission: {
        ...mission,
        habitKeys,
        taskTemplates,
        progress: challengeProgress(today, today, days),
      },
    });
  }

  if (action === "end") {
    await prisma.mission.updateMany({
      where: { userId: session.user.id, active: true },
      data: { active: false },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "morning-flow") {
    const step = String(body.step || "");
    if (!["reminders", "todos", "done"].includes(step)) {
      return NextResponse.json({ error: "Invalid step" }, { status: 400 });
    }
    const plan = await prisma.dayPlan.upsert({
      where: {
        userId_date: { userId: session.user.id, date: today },
      },
      create: {
        userId: session.user.id,
        date: today,
        morningFlow: step,
      },
      update: { morningFlow: step },
    });
    return NextResponse.json({ morningFlow: plan.morningFlow });
  }

  if (action === "seed-today-tasks") {
    const mission = await prisma.mission.findFirst({
      where: { userId: session.user.id, active: true },
    });
    const templates = parseJsonArray(mission?.taskTemplates);
    const extra = Array.isArray(body.todos)
      ? (body.todos as unknown[])
          .map((t) => String(t).trim().slice(0, 120))
          .filter(Boolean)
      : [];
    const texts = [...templates, ...extra].slice(0, 12);
    if (texts.length) {
      const existing = await prisma.todo.findMany({
        where: { userId: session.user.id, date: today },
      });
      const have = new Set(existing.map((t) => t.text.toLowerCase()));
      const toAdd = texts.filter((t) => !have.has(t.toLowerCase()));
      if (toAdd.length) {
        await prisma.todo.createMany({
          data: toAdd.map((text) => ({
            userId: session.user.id,
            date: today,
            text,
          })),
        });
      }
    }
    const todos = await prisma.todo.findMany({
      where: { userId: session.user.id, date: today },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ todos });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
