import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDefaultHabits } from "@/lib/ensure-habits";
import { slugifyHabitKey } from "@/lib/habits";
import { enrichHabitsWithWindows } from "@/lib/habit-windows";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wakeGoal = session.user.wakeGoal || "06:00";
  const sleepGoal = session.user.sleepGoal || "23:00";

  const habits = enrichHabitsWithWindows(
    await ensureDefaultHabits(session.user.id),
    wakeGoal,
    sleepGoal
  );
  const all = enrichHabitsWithWindows(
    await prisma.habit.findMany({
      where: { userId: session.user.id },
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
    }),
    wakeGoal,
    sleepGoal
  );

  return NextResponse.json({ habits, all, wakeGoal, sleepGoal });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDefaultHabits(session.user.id);
  const body = await req.json();
  const label = String(body.label || "").trim().slice(0, 60);
  if (!label) {
    return NextResponse.json({ error: "Label required" }, { status: 400 });
  }

  let key = body.key ? String(body.key) : slugifyHabitKey(label);
  key = key.slice(0, 40);

  const description = String(body.description || "").slice(0, 160);

  const existing = await prisma.habit.findUnique({
    where: { userId_key: { userId: session.user.id, key } },
  });
  if (existing) {
    const habit = await prisma.habit.update({
      where: { id: existing.id },
      data: {
        active: true,
        label: label || existing.label,
        description: description || existing.description,
      },
    });
    return NextResponse.json({ habit, reactivated: true });
  }

  const maxSort = await prisma.habit.aggregate({
    where: { userId: session.user.id },
    _max: { sortOrder: true },
  });

  const habit = await prisma.habit.create({
    data: {
      userId: session.user.id,
      key,
      label,
      description,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      isDefault: false,
      active: true,
    },
  });
  return NextResponse.json({ habit });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.habit.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: {
    label?: string;
    description?: string;
    active?: boolean;
    sortOrder?: number;
    windowStart?: string | null;
    windowEnd?: string | null;
  } = {};
  if (typeof body.label === "string") data.label = body.label.trim().slice(0, 60);
  if (typeof body.description === "string")
    data.description = body.description.slice(0, 160);
  if (typeof body.active === "boolean") data.active = body.active;
  if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;
  if (body.windowStart === null) data.windowStart = null;
  else if (typeof body.windowStart === "string" && /^\d{2}:\d{2}$/.test(body.windowStart))
    data.windowStart = body.windowStart;
  if (body.windowEnd === null) data.windowEnd = null;
  else if (typeof body.windowEnd === "string" && /^\d{2}:\d{2}$/.test(body.windowEnd))
    data.windowEnd = body.windowEnd;
  if (
    (data.windowStart !== undefined || data.windowEnd !== undefined) &&
    body.clearWindow === true
  ) {
    data.windowStart = null;
    data.windowEnd = null;
  }

  const habit = await prisma.habit.update({ where: { id }, data });
  return NextResponse.json({ habit });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.habit.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Soft-delete defaults; hard-delete custom
  if (existing.isDefault) {
    const habit = await prisma.habit.update({
      where: { id },
      data: { active: false },
    });
    return NextResponse.json({ habit, soft: true });
  }

  await prisma.habit.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
