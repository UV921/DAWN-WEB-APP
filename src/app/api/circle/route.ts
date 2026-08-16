import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  computeStreak,
  isHabitDone,
  mergeLogChecks,
  randomInviteCode,
} from "@/lib/habits";
import { formatDateInZone } from "@/lib/clock";
import { discordSendDm } from "@/lib/discord-notify";

function toClientLog(l: {
  userId: string;
  date: string;
  wakeTime: string | null;
  bedtime: string | null;
  checks: string;
  sleepEarly: boolean;
  noPhone: boolean;
  wakeEarly: boolean;
  gym: boolean;
  reading: boolean;
  quran: boolean;
}) {
  return {
    ...l,
    checks: mergeLogChecks(l),
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await prisma.circleMember.findMany({
    where: { userId: session.user.id },
    include: {
      circle: {
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                  discordId: true,
                  openStreak: true,
                  wakeGoal: true,
                  focusHabitKey: true,
                  xp: true,
                  level: true,
                  challengeStartDate: true,
                },
              },
            },
          },
          owner: { select: { id: true, name: true } },
        },
      },
    },
  });

  const circles = memberships.map((m) => m.circle);
  const today = formatDateInZone(session.user.timezone);
  const since = formatDateInZone(
    session.user.timezone,
    new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
  );

  const boards = await Promise.all(
    circles.map(async (circle) => {
      const userIds = circle.members.map((m) => m.userId);
      const logs = await prisma.habitLog.findMany({
        where: { userId: { in: userIds }, date: { gte: since } },
        orderBy: { date: "asc" },
      });

      const byUser = new Map<string, ReturnType<typeof toClientLog>[]>();
      for (const l of logs) {
        const list = byUser.get(l.userId) || [];
        list.push(toClientLog(l));
        byUser.set(l.userId, list);
      }

      const members = circle.members.map((m) => {
        const userLogs = byUser.get(m.userId) || [];
        const todayLog = userLogs.find((l) => l.date === today) || null;
        const earlyStreak = computeStreak(userLogs, (l) =>
          isHabitDone(l, "wakeEarly")
        );
        const checkedIn = Boolean(todayLog?.wakeTime);
        const wakeOnTime =
          checkedIn &&
          Boolean(todayLog && isHabitDone(todayLog, "wakeEarly"));

        // last 7 days wake early rate
        const last7 = userLogs.filter(
          (l) =>
            l.date >=
            formatDateInZone(
              session.user.timezone,
              new Date(Date.now() - 6 * 86400000)
            )
        );
        const wakeDays = last7.filter((l) => isHabitDone(l, "wakeEarly")).length;

        return {
          user: m.user,
          log: todayLog,
          stats: {
            checkedIn,
            wakeOnTime,
            earlyStreak: earlyStreak.current,
            openStreak: m.user.openStreak,
            level: m.user.level,
            xp: m.user.xp,
            wakeGoal: m.user.wakeGoal,
            wakeDays7: wakeDays,
            needsNudge: !checkedIn,
          },
        };
      });

      const up = members.filter((x) => x.stats.checkedIn).length;
      const onTime = members.filter((x) => x.stats.wakeOnTime).length;
      const needNudge = members.filter((x) => x.stats.needsNudge);

      return {
        circleId: circle.id,
        date: today,
        summary: {
          total: members.length,
          up,
          onTime,
          needNudge: needNudge.length,
        },
        members,
      };
    })
  );

  return NextResponse.json({
    circles,
    boards,
    me: session.user.id,
    howTo: [
      "Create a circle (you become the owner).",
      "Copy the invite code and send it to a friend.",
      "Friend opens Dawn → Friends → pastes code → Join.",
      "Optional: owner pastes a Discord channel ID so check-ins can post there.",
      "Both of you check in on Today — the board updates live.",
      "Tap Nudge if someone isn’t up yet (needs Discord linked + bot running).",
    ],
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const action = body.action as string;

  if (action === "create") {
    const name = String(body.name || "Morning Circle").trim().slice(0, 60);
    const discordChannelId = body.discordChannelId
      ? String(body.discordChannelId).replace(/\D/g, "").slice(0, 32)
      : process.env.DISCORD_CHANNEL_ID || null;

    let inviteCode = randomInviteCode();
    for (let i = 0; i < 5; i++) {
      const exists = await prisma.accountabilityCircle.findUnique({
        where: { inviteCode },
      });
      if (!exists) break;
      inviteCode = randomInviteCode();
    }

    const circle = await prisma.accountabilityCircle.create({
      data: {
        name: name || "Morning Circle",
        inviteCode,
        ownerId: session.user.id,
        discordChannelId,
        members: {
          create: { userId: session.user.id },
        },
      },
      include: { members: true },
    });

    return NextResponse.json({ circle });
  }

  if (action === "join") {
    const code = String(body.inviteCode || "")
      .trim()
      .toUpperCase();
    const circle = await prisma.accountabilityCircle.findUnique({
      where: { inviteCode: code },
    });
    if (!circle) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    }
    await prisma.circleMember.upsert({
      where: {
        circleId_userId: {
          circleId: circle.id,
          userId: session.user.id,
        },
      },
      create: { circleId: circle.id, userId: session.user.id },
      update: {},
    });
    return NextResponse.json({ circle });
  }

  if (action === "rename") {
    const circleId = String(body.circleId || "");
    const name = String(body.name || "").trim().slice(0, 60);
    if (!name) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }
    const circle = await prisma.accountabilityCircle.findFirst({
      where: { id: circleId, ownerId: session.user.id },
    });
    if (!circle) {
      return NextResponse.json({ error: "Not found or not owner" }, { status: 403 });
    }
    const updated = await prisma.accountabilityCircle.update({
      where: { id: circleId },
      data: { name },
    });
    return NextResponse.json({ circle: updated });
  }

  if (action === "updateChannel") {
    const circleId = String(body.circleId);
    const discordChannelId =
      String(body.discordChannelId || "").replace(/\D/g, "").slice(0, 32) || null;
    const circle = await prisma.accountabilityCircle.findFirst({
      where: { id: circleId, ownerId: session.user.id },
    });
    if (!circle) {
      return NextResponse.json({ error: "Not found or not owner" }, { status: 403 });
    }
    const updated = await prisma.accountabilityCircle.update({
      where: { id: circleId },
      data: { discordChannelId },
    });
    return NextResponse.json({ circle: updated });
  }

  if (action === "regenerateInvite") {
    const circleId = String(body.circleId || "");
    const circle = await prisma.accountabilityCircle.findFirst({
      where: { id: circleId, ownerId: session.user.id },
    });
    if (!circle) {
      return NextResponse.json({ error: "Not found or not owner" }, { status: 403 });
    }
    let inviteCode = randomInviteCode();
    for (let i = 0; i < 5; i++) {
      const exists = await prisma.accountabilityCircle.findUnique({
        where: { inviteCode },
      });
      if (!exists) break;
      inviteCode = randomInviteCode();
    }
    const updated = await prisma.accountabilityCircle.update({
      where: { id: circleId },
      data: { inviteCode },
    });
    return NextResponse.json({ circle: updated });
  }

  if (action === "leave") {
    const circleId = String(body.circleId || "");
    const circle = await prisma.accountabilityCircle.findUnique({
      where: { id: circleId },
      include: { members: true },
    });
    if (!circle) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (circle.ownerId === session.user.id) {
      // Owner leaving: transfer to another member or delete circle
      const others = circle.members.filter((m) => m.userId !== session.user.id);
      if (others.length === 0) {
        await prisma.accountabilityCircle.delete({ where: { id: circleId } });
        return NextResponse.json({ ok: true, deleted: true });
      }
      await prisma.$transaction([
        prisma.circleMember.delete({
          where: {
            circleId_userId: { circleId, userId: session.user.id },
          },
        }),
        prisma.accountabilityCircle.update({
          where: { id: circleId },
          data: { ownerId: others[0].userId },
        }),
      ]);
      return NextResponse.json({ ok: true, transferred: true });
    }
    await prisma.circleMember.delete({
      where: {
        circleId_userId: { circleId, userId: session.user.id },
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "removeMember") {
    const circleId = String(body.circleId || "");
    const userId = String(body.userId || "");
    const circle = await prisma.accountabilityCircle.findFirst({
      where: { id: circleId, ownerId: session.user.id },
    });
    if (!circle) {
      return NextResponse.json({ error: "Not found or not owner" }, { status: 403 });
    }
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: "Use Leave to leave your own circle" },
        { status: 400 }
      );
    }
    await prisma.circleMember.deleteMany({
      where: { circleId, userId },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "nudge") {
    const circleId = String(body.circleId || "");
    const targetUserId = String(body.userId || "");
    const membership = await prisma.circleMember.findUnique({
      where: {
        circleId_userId: { circleId, userId: session.user.id },
      },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not in this circle" }, { status: 403 });
    }
    const targetMember = await prisma.circleMember.findUnique({
      where: {
        circleId_userId: { circleId, userId: targetUserId },
      },
      include: {
        user: { select: { discordId: true, name: true } },
        circle: { select: { name: true } },
      },
    });
    if (!targetMember?.user.discordId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Friend hasn’t linked Discord. Ask them to open Settings → Discord.",
        },
        { status: 400 }
      );
    }
    const fromName = session.user.name || "A friend";
    const res = await discordSendDm(targetMember.user.discordId, {
      title: `${fromName} nudged you`,
      body: `Your circle “${targetMember.circle.name}” is waiting. Open Dawn and hold to rise — they’re already up or counting on you.`,
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: res.error || "DM failed" },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
