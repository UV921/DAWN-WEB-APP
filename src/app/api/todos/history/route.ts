import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateInZone } from "@/lib/clock";

type DayGroup = {
  date: string;
  total: number;
  done: number;
  todos: {
    id: string;
    text: string;
    done: boolean;
    title: string;
    priority: string;
    remindAt: string | null;
  }[];
};

const MAX_DAYS = 60;

/**
 * Past task lists: jump to one date, or search every day by text.
 * Results come back newest day first so the recent stuff is on top.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const today = formatDateInZone(session.user.timezone);
  const rawDate = searchParams.get("date") || "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : "";
  const q = (searchParams.get("q") || "").trim().slice(0, 80);

  const todos = await prisma.todo.findMany({
    where: {
      userId: session.user.id,
      parentId: null,
      ...(date ? { date } : {}),
      ...(q ? { text: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "asc" }],
    // A day can hold up to 50 tasks, so cap by rows rather than by day here.
    take: date || q ? 500 : MAX_DAYS * 20,
    select: {
      id: true,
      text: true,
      done: true,
      title: true,
      priority: true,
      remindAt: true,
      date: true,
    },
  });

  const byDate = new Map<string, DayGroup>();
  for (const t of todos) {
    const group = byDate.get(t.date) || {
      date: t.date,
      total: 0,
      done: 0,
      todos: [],
    };
    group.total += 1;
    if (t.done) group.done += 1;
    group.todos.push({
      id: t.id,
      text: t.text,
      done: t.done,
      title: t.title,
      priority: t.priority,
      remindAt: t.remindAt,
    });
    byDate.set(t.date, group);
  }

  const days = [...byDate.values()].slice(0, MAX_DAYS);

  return NextResponse.json({
    today,
    days,
    matches: todos.length,
    query: q,
    date,
  });
}
