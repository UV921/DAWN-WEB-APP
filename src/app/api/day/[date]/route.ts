import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mergeLogChecks } from "@/lib/habits";
import { formatDateInZone } from "@/lib/clock";
import { nextCalendarDate, prevCalendarDate } from "@/lib/daily-loop";
import { normalizePriority } from "@/lib/todo-weight";

/** Everything that happened on one day: tasks, habits, wake/sleep, study. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Bad date" }, { status: 400 });
  }

  const userId = session.user.id;
  const today = formatDateInZone(session.user.timezone);

  const [plan, todos, log, habitDefs, study] = await Promise.all([
    prisma.dayPlan.findUnique({ where: { userId_date: { userId, date } } }),
    prisma.todo.findMany({
      where: { userId, date },
      orderBy: { createdAt: "asc" },
    }),
    prisma.habitLog.findUnique({ where: { userId_date: { userId, date } } }),
    prisma.habit.findMany({
      where: { userId, active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.studySession.aggregate({
      where: { userId, date },
      _sum: { minutes: true },
    }),
  ]);

  const checks = log ? mergeLogChecks(log) : {};
  const habits = habitDefs.map((h) => ({
    key: h.key,
    label: h.label,
    done: Boolean(checks[h.key]),
  }));

  const roots = todos.filter((t) => !t.parentId);
  const done = todos.filter((t) => t.done).length;

  const byCategory = new Map<string, { total: number; done: number }>();
  const byPriority = new Map<string, { total: number; done: number }>();
  for (const t of roots) {
    const cat = byCategory.get(t.title) || { total: 0, done: 0 };
    cat.total += 1;
    if (t.done) cat.done += 1;
    byCategory.set(t.title, cat);

    const key = normalizePriority(t.priority);
    const pri = byPriority.get(key) || { total: 0, done: 0 };
    pri.total += 1;
    if (t.done) pri.done += 1;
    byPriority.set(key, pri);
  }

  return NextResponse.json({
    date,
    today,
    prev: prevCalendarDate(date),
    next: date >= today ? null : nextCalendarDate(date),
    plan: plan
      ? {
          goalText: plan.goalText,
          wakeGoal: plan.wakeGoal,
          reviewed: plan.reviewed,
        }
      : null,
    log: log
      ? { wakeTime: log.wakeTime, bedtime: log.bedtime, notes: log.notes }
      : null,
    wakeGoal: plan?.wakeGoal || session.user.wakeGoal || "06:00",
    sleepGoal: session.user.sleepGoal || "23:00",
    habits,
    habitsDone: habits.filter((h) => h.done).length,
    todos: todos.map((t) => ({
      id: t.id,
      text: t.text,
      done: t.done,
      title: t.title,
      priority: normalizePriority(t.priority),
      remindAt: t.remindAt,
      parentId: t.parentId,
    })),
    summary: {
      total: roots.length,
      done: roots.filter((t) => t.done).length,
      allTotal: todos.length,
      allDone: done,
      byCategory: [...byCategory.entries()].map(([name, v]) => ({
        name,
        ...v,
      })),
      byPriority: [...byPriority.entries()].map(([name, v]) => ({
        name,
        ...v,
      })),
    },
    studyMinutes: study._sum.minutes || 0,
  });
}
