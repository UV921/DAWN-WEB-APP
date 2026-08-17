import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normChannelId } from "@/lib/bot-messages";

const TARGETS = new Set(["channel", "dm", "both"]);

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [reminders, user] = await Promise.all([
    prisma.reminder.findMany({
      where: { userId: session.user.id },
      orderBy: [{ enabled: "desc" }, { time: "asc" }],
      include: {
        goal: { select: { id: true, title: true } },
        todo: { select: { id: true, done: true, date: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        discordNotifyDefault: true,
        discordChannelId: true,
        discordId: true,
        wakeGoal: true,
        sleepGoal: true,
        timezone: true,
      },
    }),
  ]);

  return NextResponse.json({
    reminders,
    prefs: user,
    hasDiscord: Boolean(user?.discordId),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const title = String(body.title || "").trim().slice(0, 80);
  const time = String(body.time || "");
  if (!title) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return NextResponse.json({ error: "Valid time required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  const discordTarget = TARGETS.has(body.discordTarget)
    ? String(body.discordTarget)
    : user?.discordNotifyDefault === "off"
      ? "channel"
      : user?.discordNotifyDefault || "channel";

  const reminder = await prisma.reminder.create({
    data: {
      userId: session.user.id,
      goalId: body.goalId ? String(body.goalId) : null,
      title,
      message: String(body.message || "").slice(0, 240),
      time,
      enabled: body.enabled !== false,
      notifyBrowser: body.notifyBrowser !== false,
      notifyDiscord: Boolean(body.notifyDiscord),
      discordTarget,
      discordChannelId: body.discordChannelId
        ? normChannelId(body.discordChannelId) || null
        : null,
    },
  });

  return NextResponse.json({ reminder });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.reminder.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = body.title.trim().slice(0, 80);
  if (typeof body.message === "string")
    data.message = body.message.slice(0, 240);
  if (typeof body.time === "string" && /^\d{2}:\d{2}$/.test(body.time))
    data.time = body.time;
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (typeof body.notifyBrowser === "boolean")
    data.notifyBrowser = body.notifyBrowser;
  if (typeof body.notifyDiscord === "boolean")
    data.notifyDiscord = body.notifyDiscord;
  if (TARGETS.has(body.discordTarget)) data.discordTarget = body.discordTarget;
  if (body.discordChannelId !== undefined) {
    data.discordChannelId = body.discordChannelId
      ? normChannelId(body.discordChannelId) || null
      : null;
  }
  if (body.goalId !== undefined) {
    data.goalId = body.goalId ? String(body.goalId) : null;
  }

  const reminder = await prisma.reminder.update({ where: { id }, data });
  return NextResponse.json({ reminder });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.reminder.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.reminder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
