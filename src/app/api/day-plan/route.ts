import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatLocalDate } from "@/lib/habits";
import { nextCalendarDate } from "@/lib/daily-loop";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const today = formatLocalDate(new Date());
  const date = searchParams.get("date") || today;
  const tomorrow = nextCalendarDate(today);

  const [plan, todos, tomorrowPlan, tomorrowTodos] = await Promise.all([
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
  ]);

  return NextResponse.json({
    today,
    tomorrow,
    plan,
    todos,
    tomorrowPlan,
    tomorrowTodos,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const today = formatLocalDate(new Date());
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

  // Soft: also bump sleep goal reminder path — user closed the day
  return NextResponse.json({ plan, todos, date });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
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
  return NextResponse.json({ todo: updated });
}
