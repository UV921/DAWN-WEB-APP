import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateInZone } from "@/lib/clock";
import { nextCalendarDate } from "@/lib/daily-loop";
import { grantXp } from "@/lib/grant-xp";
import { resolveHabitWindow } from "@/lib/habit-windows";
import { normalizeListTitle } from "@/lib/todo-lists";
import { normalizePriority, parseRemindAt } from "@/lib/todo-weight";
import { syncTodoReminder } from "@/lib/todo-reminders";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const today = formatDateInZone(session.user.timezone);
  const date = searchParams.get("date") || today;
  const tomorrow = nextCalendarDate(today);

  const wakeGoal = session.user.wakeGoal || "06:00";
  const sleepGoal = session.user.sleepGoal || "23:00";

  const [plan, todos, tomorrowPlan, tomorrowTodos, sleepHabit] =
    await Promise.all([
      prisma.dayPlan.findUnique({
        where: { userId_date: { userId: session.user.id, date } },
      }),
      prisma.todo.findMany({
        where: { userId: session.user.id, date },
        orderBy: { createdAt: "asc" },
      }),
      prisma.dayPlan.findUnique({
        where: { userId_date: { userId: session.user.id, date: tomorrow } },
      }),
      prisma.todo.findMany({
        where: { userId: session.user.id, date: tomorrow },
        orderBy: { createdAt: "asc" },
      }),
      prisma.habit.findFirst({
        where: { userId: session.user.id, key: "sleepEarly" },
        select: { windowStart: true, windowEnd: true },
      }),
    ]);

  const sleepWindow = resolveHabitWindow(
    {
      key: "sleepEarly",
      label: "Sleep",
      windowStart: sleepHabit?.windowStart,
      windowEnd: sleepHabit?.windowEnd,
    },
    wakeGoal,
    sleepGoal
  );

  return NextResponse.json({
    today,
    tomorrow,
    plan,
    todos,
    tomorrowPlan,
    tomorrowTodos,
    wakeGoal,
    sleepGoal,
    sleepWindow: { start: sleepWindow.start, end: sleepWindow.end },
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const today = formatDateInZone(session.user.timezone);
  const date =
    typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : nextCalendarDate(today);

  const wakeGoal =
    typeof body.wakeGoal === "string" && /^\d{2}:\d{2}$/.test(body.wakeGoal)
      ? body.wakeGoal
      : session.user.wakeGoal || "06:00";
  const goalText = String(body.goalText || "").trim().slice(0, 200);
  const todoTexts = Array.isArray(body.todos)
    ? (body.todos as unknown[])
        .map((t) => String(t || "").trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 8)
    : [];

  const existed = await prisma.dayPlan.findUnique({
    where: { userId_date: { userId: session.user.id, date } },
    select: { id: true },
  });

  const plan = await prisma.dayPlan.upsert({
    where: { userId_date: { userId: session.user.id, date } },
    create: {
      userId: session.user.id,
      date,
      wakeGoal,
      goalText,
    },
    update: {
      wakeGoal,
      goalText,
    },
  });

  if (body.replaceTodos === true) {
    await prisma.todo.deleteMany({
      where: { userId: session.user.id, date },
    });
    if (todoTexts.length) {
      await prisma.todo.createMany({
        data: todoTexts.map((text) => ({
          userId: session.user.id,
          date,
          text,
        })),
      });
    }
  }

  const todos = await prisma.todo.findMany({
    where: { userId: session.user.id, date },
    orderBy: { createdAt: "asc" },
  });

  let xpGained = 0;
  if (!existed) {
    const granted = await grantXp(session.user.id, 12);
    xpGained = granted?.gained || 0;
  }

  return NextResponse.json({ plan, todos, date, xpGained });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const today = formatDateInZone(session.user.timezone);

  if (body.action === "add-todo") {
    const text = String(body.text || "").trim().slice(0, 120);
    if (!text) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }
    const date =
      typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : today;
    const count = await prisma.todo.count({
      where: { userId: session.user.id, date },
    });
    if (count >= 50) {
      return NextResponse.json({ error: "Too many tasks today" }, { status: 400 });
    }
    const title = normalizeListTitle(body.title);
    const priority = normalizePriority(body.priority);
    const remindAt = parseRemindAt(body.remindAt);
    const parentId =
      typeof body.parentId === "string" && body.parentId
        ? body.parentId
        : null;

    if (parentId) {
      const parent = await prisma.todo.findFirst({
        where: { id: parentId, userId: session.user.id },
      });
      if (!parent) {
        return NextResponse.json({ error: "Parent not found" }, { status: 404 });
      }
      if (parent.parentId) {
        return NextResponse.json(
          { error: "Subtasks can’t have children" },
          { status: 400 }
        );
      }
      const kids = await prisma.todo.count({
        where: { userId: session.user.id, parentId },
      });
      if (kids >= 8) {
        return NextResponse.json(
          { error: "Max 8 subtasks" },
          { status: 400 }
        );
      }
    }

    let todo = await prisma.todo.create({
      data: {
        userId: session.user.id,
        date,
        title,
        text,
        priority,
        remindAt,
        parentId,
      },
    });
    if (remindAt) {
      await syncTodoReminder(prisma, { userId: session.user.id, todo });
      todo = (await prisma.todo.findUnique({ where: { id: todo.id } })) || todo;
    }
    return NextResponse.json({ todo });
  }

  if (body.action === "add-subtask") {
    const text = String(body.text || "").trim().slice(0, 120);
    const parentId = String(body.parentId || "");
    if (!text) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }
    if (!parentId) {
      return NextResponse.json({ error: "parentId required" }, { status: 400 });
    }
    const parent = await prisma.todo.findFirst({
      where: { id: parentId, userId: session.user.id },
    });
    if (!parent) {
      return NextResponse.json({ error: "Parent not found" }, { status: 404 });
    }
    if (parent.parentId) {
      return NextResponse.json(
        { error: "Subtasks can’t have children" },
        { status: 400 }
      );
    }
    const kids = await prisma.todo.count({
      where: { userId: session.user.id, parentId },
    });
    if (kids >= 8) {
      return NextResponse.json({ error: "Max 8 subtasks" }, { status: 400 });
    }
    const todo = await prisma.todo.create({
      data: {
        userId: session.user.id,
        date: parent.date,
        title: parent.title,
        text,
        priority: normalizePriority(body.priority || parent.priority),
        parentId,
      },
    });
    return NextResponse.json({ todo });
  }

  if (body.action === "update-todo") {
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const todo = await prisma.todo.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!todo) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: {
      text?: string;
      priority?: string;
      remindAt?: string | null;
      title?: string;
      date?: string;
    } = {};
    if (typeof body.text === "string") {
      const text = body.text.trim().slice(0, 120);
      if (!text) {
        return NextResponse.json({ error: "text required" }, { status: 400 });
      }
      data.text = text;
    }
    if (body.title !== undefined) {
      data.title = normalizeListTitle(body.title);
    }
    if (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      data.date = body.date;
    }
    if (body.priority !== undefined) {
      data.priority = normalizePriority(body.priority);
    }
    if (body.remindAt !== undefined) {
      data.remindAt = parseRemindAt(body.remindAt);
    }

    let updated = await prisma.todo.update({ where: { id }, data });
    // Steps live on the same day as their parent.
    if (data.date && data.date !== todo.date) {
      await prisma.todo.updateMany({
        where: { userId: session.user.id, parentId: id },
        data: { date: data.date },
      });
    }
    if (
      body.remindAt !== undefined ||
      typeof body.text === "string" ||
      body.done !== undefined
    ) {
      await syncTodoReminder(prisma, {
        userId: session.user.id,
        todo: updated,
        remindAt: updated.remindAt,
        done: updated.done,
      });
      updated = (await prisma.todo.findUnique({ where: { id } })) || updated;
    }
    return NextResponse.json({ todo: updated });
  }

  if (body.action === "delete-todo") {
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const todo = await prisma.todo.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!todo) return NextResponse.json({ ok: true });
    await prisma.todo.deleteMany({
      where: {
        userId: session.user.id,
        OR: [{ id }, { parentId: id }],
      },
    });
    return NextResponse.json({ ok: true });
  }

  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const todo = await prisma.todo.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!todo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.todo.update({
    where: { id },
    data: { done: typeof body.done === "boolean" ? body.done : !todo.done },
  });

  await syncTodoReminder(prisma, {
    userId: session.user.id,
    todo: updated,
    done: updated.done,
  });

  let xpGained = 0;
  if (updated.done && !todo.done) {
    const remaining = await prisma.todo.count({
      where: {
        userId: session.user.id,
        date: todo.date,
        done: false,
      },
    });
    if (remaining === 0) {
      const granted = await grantXp(session.user.id, 18);
      xpGained = granted?.gained || 0;
    }
  }

  const fresh = await prisma.todo.findUnique({ where: { id } });
  return NextResponse.json({ todo: fresh || updated, xpGained });
}
