import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  MAX_STUDY_NUDGES,
  STUDY_NUDGE_PRESETS,
  clampStudyNudgeMinutes,
  isStudyNudgePresetKey,
  minutesFromIntervalInput,
  normalizeDiscordTarget,
  studyNudgePresetByKey,
} from "@/lib/study-nudges";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [nudges, user, live] = await Promise.all([
    prisma.studyNudge.findMany({
      where: { userId: session.user.id },
      orderBy: [{ enabled: "desc" }, { createdAt: "asc" }],
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        discordNotifyDefault: true,
        discordChannelId: true,
        discordId: true,
      },
    }),
    prisma.studySession.findFirst({
      where: { userId: session.user.id, endedAt: null },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        startedAt: true,
        activity: true,
        activityKey: true,
        source: true,
      },
    }),
  ]);

  return NextResponse.json({
    nudges,
    presets: STUDY_NUDGE_PRESETS,
    live: live
      ? {
          id: live.id,
          startedAt: live.startedAt.toISOString(),
          activity: live.activity,
          activityKey: live.activityKey,
          source: live.source,
        }
      : null,
    prefs: user,
    hasDiscord: Boolean(user?.discordId),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await prisma.studyNudge.count({
    where: { userId: session.user.id },
  });
  if (count >= MAX_STUDY_NUDGES) {
    return NextResponse.json(
      { error: `You can have up to ${MAX_STUDY_NUDGES} study care pings.` },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { discordNotifyDefault: true },
  });

  if (body.seed === true || body.action === "seed") {
    const existing = await prisma.studyNudge.findMany({
      where: { userId: session.user.id },
      select: { presetKey: true },
    });
    const have = new Set(existing.map((n) => n.presetKey).filter(Boolean));
    const missing = STUDY_NUDGE_PRESETS.filter((p) => !have.has(p.key));
    const room = MAX_STUDY_NUDGES - existing.length;
    const toAdd = missing.slice(0, Math.max(0, room));
    if (toAdd.length) {
      await prisma.studyNudge.createMany({
        skipDuplicates: true,
        data: toAdd.map((p) => ({
          userId: session.user.id,
          title: p.title,
          message: p.message,
          intervalMinutes: p.intervalMinutes,
          notifyBrowser: true,
          notifyDiscord: true,
          discordTarget:
            user?.discordNotifyDefault === "off"
              ? "channel"
              : user?.discordNotifyDefault === "dm" ||
                  user?.discordNotifyDefault === "both"
                ? user.discordNotifyDefault
                : "channel",
          presetKey: p.key,
        })),
      });
    }
    const nudges = await prisma.studyNudge.findMany({
      where: { userId: session.user.id },
      orderBy: [{ enabled: "desc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ nudges, seeded: toAdd.length });
  }

  const presetKey = isStudyNudgePresetKey(body.presetKey)
    ? String(body.presetKey)
    : null;
  const preset = presetKey ? studyNudgePresetByKey(presetKey) : null;

  if (presetKey) {
    const existing = await prisma.studyNudge.findFirst({
      where: { userId: session.user.id, presetKey },
    });
    if (existing) {
      return NextResponse.json({ nudge: existing, already: true });
    }
  }

  const title = String(body.title || preset?.title || "")
    .trim()
    .slice(0, 80);
  if (!title) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }

  const intervalMinutes =
    body.intervalUnit != null || body.intervalAmount != null
      ? minutesFromIntervalInput(body.intervalAmount, body.intervalUnit)
      : clampStudyNudgeMinutes(
          body.intervalMinutes ?? preset?.intervalMinutes ?? 20
        );

  const discordTarget = normalizeDiscordTarget(
    body.discordTarget,
    user?.discordNotifyDefault === "off"
      ? "channel"
      : user?.discordNotifyDefault || "channel"
  );

  const nudge = await prisma.studyNudge.create({
    data: {
      userId: session.user.id,
      title,
      message: String(body.message || preset?.message || "").slice(0, 240),
      intervalMinutes,
      enabled: body.enabled !== false,
      notifyBrowser: body.notifyBrowser !== false,
      notifyDiscord: body.notifyDiscord !== false,
      discordTarget,
      presetKey,
    },
  });

  return NextResponse.json({ nudge });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.allEnabled === "boolean") {
    await prisma.studyNudge.updateMany({
      where: { userId: session.user.id },
      data: { enabled: body.allEnabled },
    });
    const nudges = await prisma.studyNudge.findMany({
      where: { userId: session.user.id },
      orderBy: [{ enabled: "desc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ ok: true, nudges });
  }

  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.studyNudge.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = body.title.trim().slice(0, 80);
  if (typeof body.message === "string")
    data.message = body.message.slice(0, 240);
  if (body.intervalUnit != null || body.intervalAmount != null) {
    data.intervalMinutes = minutesFromIntervalInput(
      body.intervalAmount,
      body.intervalUnit
    );
  } else if (body.intervalMinutes != null) {
    data.intervalMinutes = clampStudyNudgeMinutes(body.intervalMinutes);
  }
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (typeof body.notifyBrowser === "boolean")
    data.notifyBrowser = body.notifyBrowser;
  if (typeof body.notifyDiscord === "boolean")
    data.notifyDiscord = body.notifyDiscord;
  if (body.discordTarget !== undefined) {
    data.discordTarget = normalizeDiscordTarget(body.discordTarget);
  }

  const nudge = await prisma.studyNudge.update({ where: { id }, data });
  return NextResponse.json({ nudge });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.studyNudge.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.studyNudge.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
