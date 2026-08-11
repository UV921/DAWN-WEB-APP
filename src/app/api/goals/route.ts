import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDefaultGoals } from "@/lib/reminders";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const goals = await ensureDefaultGoals(
    prisma,
    session.user.id,
    session.user.wakeGoal || "06:00",
    session.user.sleepGoal || "23:00"
  );

  return NextResponse.json({ goals });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDefaultGoals(
    prisma,
    session.user.id,
    session.user.wakeGoal || "06:00",
    session.user.sleepGoal || "23:00"
  );

  const body = await req.json();
  const title = String(body.title || "").trim().slice(0, 80);
  if (!title) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }

  const targetTime =
    typeof body.targetTime === "string" && /^\d{2}:\d{2}$/.test(body.targetTime)
      ? body.targetTime
      : null;

  const goal = await prisma.goal.create({
    data: {
      userId: session.user.id,
      title,
      description: String(body.description || "").slice(0, 200),
      targetTime,
      kind: "custom",
      active: true,
    },
  });

  // Optional: also create a reminder at targetTime
  if (body.withReminder && targetTime) {
    await prisma.reminder.create({
      data: {
        userId: session.user.id,
        goalId: goal.id,
        title: `Goal: ${title}`,
        message: body.description
          ? String(body.description).slice(0, 200)
          : `Time for “${title}”.`,
        time: targetTime,
        enabled: true,
        notifyBrowser: true,
        notifyDiscord: Boolean(body.notifyDiscord),
        discordTarget: String(body.discordTarget || "channel"),
      },
    });
  }

  return NextResponse.json({ goal });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.goal.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: {
    title?: string;
    description?: string;
    targetTime?: string | null;
    active?: boolean;
  } = {};
  if (typeof body.title === "string") data.title = body.title.trim().slice(0, 80);
  if (typeof body.description === "string")
    data.description = body.description.slice(0, 200);
  if (body.targetTime === null) data.targetTime = null;
  else if (
    typeof body.targetTime === "string" &&
    /^\d{2}:\d{2}$/.test(body.targetTime)
  ) {
    data.targetTime = body.targetTime;
  }
  if (typeof body.active === "boolean") data.active = body.active;

  const goal = await prisma.goal.update({ where: { id }, data });

  // Keep wake/sleep user fields in sync
  if (existing.kind === "wake" && data.targetTime) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { wakeGoal: data.targetTime },
    });
  }
  if (existing.kind === "sleep" && data.targetTime) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { sleepGoal: data.targetTime },
    });
  }

  return NextResponse.json({ goal });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.goal.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.kind === "wake" || existing.kind === "sleep") {
    const goal = await prisma.goal.update({
      where: { id },
      data: { active: false },
    });
    return NextResponse.json({ goal, soft: true });
  }

  await prisma.goal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
