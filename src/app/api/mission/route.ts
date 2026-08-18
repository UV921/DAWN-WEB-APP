import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugifyHabitKey } from "@/lib/habits";
import { formatDateInZone } from "@/lib/clock";
import { ensureDefaultHabits } from "@/lib/ensure-habits";
import {
  clampMissionDays,
  isMissionKind,
  MAX_ACTIVE_MISSIONS,
  missionHabitStats,
  missionProgress,
  parseJsonArray,
  type MissionKind,
  type MissionPublic,
} from "@/lib/missions";

type MissionRow = {
  id: string;
  title: string;
  kind: string;
  note: string;
  startDate: string;
  days: number;
  active: boolean;
  habitKeys: string;
  taskTemplates: string;
  checks?: { date: string }[];
};

function toPublic(
  mission: MissionRow,
  today: string,
  habits: { key: string; label: string }[],
  logs: Parameters<typeof missionHabitStats>[0]["logs"]
): MissionPublic {
  const kind: MissionKind = isMissionKind(mission.kind) ? mission.kind : "run";
  const keys = parseJsonArray(mission.habitKeys);
  const checkDates = (mission.checks || [])
    .map((c) => c.date)
    .sort();
  const progress = missionProgress(mission.startDate, today, mission.days);
  return {
    id: mission.id,
    title: mission.title,
    kind,
    note: mission.note || "",
    startDate: mission.startDate,
    days: mission.days,
    active: mission.active,
    habitKeys: keys,
    taskTemplates: parseJsonArray(mission.taskTemplates),
    progress,
    habitStats: keys.length
      ? missionHabitStats({ keys, habits, logs, today })
      : [],
    checkDates,
    daysWorked: checkDates.length,
    doneToday: checkDates.includes(today),
  };
}

async function loadLogs(
  userId: string,
  since: string | undefined,
  today: string
) {
  if (!since) return [];
  return prisma.habitLog.findMany({
    where: { userId, date: { gte: since, lte: today } },
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = formatDateInZone(session.user.timezone);
  const habits = await ensureDefaultHabits(session.user.id);

  const rows = await prisma.mission.findMany({
    where: { userId: session.user.id },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    include: { checks: { select: { date: true } } },
    take: 40,
  });

  const earliest = rows.reduce<string | undefined>((acc, m) => {
    if (!acc || m.startDate < acc) return m.startDate;
    return acc;
  }, undefined);
  const logs = await loadLogs(session.user.id, earliest, today);

  const all = rows.map((m) => toPublic(m, today, habits, logs));
  const live = all.filter((m) => m.active);

  const plan = await prisma.dayPlan.findUnique({
    where: {
      userId_date: { userId: session.user.id, date: today },
    },
  });

  const todos = await prisma.todo.findMany({
    where: { userId: session.user.id, date: today },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    missions: live,
    history: all.filter((m) => !m.active),
    /** Primary card: newest live mission (manual first, then run). */
    mission:
      live.find((m) => m.kind === "manual") || live[0] || all[0] || null,
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
  const today = formatDateInZone(session.user.timezone);
  const userId = session.user.id;

  if (action === "create") {
    const kind: MissionKind = isMissionKind(body.kind) ? body.kind : "run";
    const defaultTitle =
      kind === "manual" ? "Hackathon" : "7-day mission";
    const title = String(body.title || defaultTitle).trim().slice(0, 80);
    const note = String(body.note || "").trim().slice(0, 200);
    const rawDays = body.days;
    const ongoing = kind === "manual" && (rawDays === 0 || rawDays === "0");
    const days = ongoing ? 0 : clampMissionDays(rawDays ?? (kind === "manual" ? 3 : 7), kind);
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

    const newHabits = Array.isArray(body.newHabits)
      ? (body.newHabits as { label?: string; description?: string }[])
      : [];

    await ensureDefaultHabits(userId);

    for (const nh of newHabits) {
      const label = String(nh.label || "").trim().slice(0, 60);
      if (!label) continue;
      const key = slugifyHabitKey(label).slice(0, 40);
      const existing = await prisma.habit.findUnique({
        where: { userId_key: { userId, key } },
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
          where: { userId },
          _max: { sortOrder: true },
        });
        await prisma.habit.create({
          data: {
            userId,
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

    if (kind === "run" && !habitKeys.includes("wakeEarly")) {
      habitKeys = ["wakeEarly", ...habitKeys];
    }

    if (kind === "run") {
      await prisma.mission.updateMany({
        where: { userId, active: true, kind: "run" },
        data: { active: false },
      });
    }

    const activeCount = await prisma.mission.count({
      where: { userId, active: true },
    });
    if (activeCount >= MAX_ACTIVE_MISSIONS) {
      return NextResponse.json(
        { error: `At most ${MAX_ACTIVE_MISSIONS} missions can run at once.` },
        { status: 400 }
      );
    }

    if (habitKeys.length) {
      await prisma.habit.updateMany({
        where: { userId, key: { in: habitKeys } },
        data: { active: true },
      });
    }

    const created = await prisma.mission.create({
      data: {
        userId,
        title: title || defaultTitle,
        kind,
        note,
        startDate: today,
        days,
        active: true,
        habitKeys: JSON.stringify(habitKeys),
        taskTemplates: JSON.stringify(taskTemplates),
      },
      include: { checks: { select: { date: true } } },
    });

    if (kind === "run") {
      await prisma.user.update({
        where: { id: userId },
        data: {
          challengeStartDate: today,
          challengeDays: days || 7,
          focusHabitKey: habitKeys[0] || "wakeEarly",
        },
      });
    }

    const habits = await ensureDefaultHabits(userId);
    const mission = toPublic(created, today, habits, []);
    return NextResponse.json({ mission });
  }

  if (action === "end") {
    const missionId = typeof body.missionId === "string" ? body.missionId : "";
    if (missionId) {
      await prisma.mission.updateMany({
        where: { userId, id: missionId, active: true },
        data: { active: false },
      });
    } else {
      await prisma.mission.updateMany({
        where: { userId, active: true },
        data: { active: false },
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "set-days") {
    const missionId = String(body.missionId || "");
    if (!missionId) {
      return NextResponse.json({ error: "Missing mission" }, { status: 400 });
    }
    const row = await prisma.mission.findFirst({
      where: { id: missionId, userId, active: true },
    });
    if (!row) {
      return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    }
    const kind: MissionKind = isMissionKind(row.kind) ? row.kind : "run";
    const ongoing = kind === "manual" && (body.days === 0 || body.days === "0");
    let days = ongoing ? 0 : clampMissionDays(body.days, kind);
    const progress = missionProgress(row.startDate, today, row.days);
    if (days > 0 && days < progress.day) {
      days = progress.day;
    }
    const updated = await prisma.mission.update({
      where: { id: row.id },
      data: { days },
      include: { checks: { select: { date: true } } },
    });
    const habits = await ensureDefaultHabits(userId);
    const logs = await loadLogs(userId, row.startDate, today);
    return NextResponse.json({
      mission: toPublic(updated, today, habits, logs),
    });
  }

  if (action === "check") {
    const missionId = String(body.missionId || "");
    if (!missionId) {
      return NextResponse.json({ error: "Missing mission" }, { status: 400 });
    }
    const mission = await prisma.mission.findFirst({
      where: { id: missionId, userId, active: true },
    });
    if (!mission) {
      return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    }
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || ""))
      ? String(body.date)
      : today;
    if (date < mission.startDate) {
      return NextResponse.json({ error: "Before this mission started" }, { status: 400 });
    }
    const progress = missionProgress(mission.startDate, date, mission.days);
    if (progress.ended) {
      return NextResponse.json({ error: "This mission already ended" }, { status: 400 });
    }
    const done = body.done !== false;
    if (done) {
      await prisma.missionCheck.upsert({
        where: { missionId_date: { missionId, date } },
        create: {
          missionId,
          date,
          note: String(body.note || "").slice(0, 160),
        },
        update: { note: String(body.note || "").slice(0, 160) },
      });
    } else {
      await prisma.missionCheck.deleteMany({
        where: { missionId, date },
      });
    }
    const updated = await prisma.mission.findFirst({
      where: { id: missionId, userId },
      include: { checks: { select: { date: true } } },
    });
    const habits = await ensureDefaultHabits(userId);
    const logs = await loadLogs(userId, mission.startDate, today);
    return NextResponse.json({
      mission: updated ? toPublic(updated, today, habits, logs) : null,
    });
  }

  if (action === "morning-flow") {
    const step = String(body.step || "");
    if (!["reminders", "todos", "done"].includes(step)) {
      return NextResponse.json({ error: "Invalid step" }, { status: 400 });
    }
    const plan = await prisma.dayPlan.upsert({
      where: {
        userId_date: { userId, date: today },
      },
      create: {
        userId,
        date: today,
        morningFlow: step,
      },
      update: { morningFlow: step },
    });
    return NextResponse.json({ morningFlow: plan.morningFlow });
  }

  if (action === "seed-today-tasks") {
    const missionId = typeof body.missionId === "string" ? body.missionId : "";
    const mission = missionId
      ? await prisma.mission.findFirst({
          where: { userId, id: missionId, active: true },
        })
      : await prisma.mission.findFirst({
          where: { userId, active: true },
          orderBy: { createdAt: "desc" },
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
        where: { userId, date: today },
      });
      const have = new Set(existing.map((t) => t.text.toLowerCase()));
      const toAdd = texts.filter((t) => !have.has(t.toLowerCase()));
      if (toAdd.length) {
        await prisma.todo.createMany({
          data: toAdd.map((text) => ({
            userId,
            date: today,
            text,
          })),
        });
      }
    }
    const todos = await prisma.todo.findMany({
      where: { userId, date: today },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ todos });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
