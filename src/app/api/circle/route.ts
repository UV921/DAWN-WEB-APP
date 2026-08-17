import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  completedCount,
  computeStreak,
  isHabitDone,
  mergeLogChecks,
  randomInviteCode,
} from "@/lib/habits";
import { formatDateInZone } from "@/lib/clock";
import { discordSendChannelMessage, discordSendDm } from "@/lib/discord-notify";
import { normChannelId } from "@/lib/bot-messages";
import { enrollDiscordFriend } from "@/lib/discord-enroll";
import { inviteLink, parseInviteInput } from "@/lib/circle-invite";
import { assignRanks, combinedScore } from "@/lib/circle-board";
import { studyMinutesByUser } from "@/lib/study-stats";
import {
  canAddFriendToCircle,
  getDiscordGroupInfo,
  listFriendSuggestions,
  searchDiscordFriends,
} from "@/lib/circle-friends";

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

async function uniqueInviteCode() {
  let inviteCode = randomInviteCode();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.accountabilityCircle.findUnique({
      where: { inviteCode },
    });
    if (!exists) break;
    inviteCode = randomInviteCode();
  }
  return inviteCode;
}

function siteOrigin() {
  return (process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meId = session.user.id;
  const { searchParams } = new URL(req.url);
  const searchQ = (searchParams.get("q") || "").trim();

  const [me, memberships, suggestions, discordGroup, searchHits] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: meId },
        select: { discordId: true, name: true },
      }),
      prisma.circleMember.findMany({
        where: { userId: meId },
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
                      consistencyStreak: true,
                    },
                  },
                },
              },
              owner: { select: { id: true, name: true } },
            },
          },
        },
      }),
      listFriendSuggestions({ meId }),
      getDiscordGroupInfo(meId),
      searchQ.length >= 1
        ? searchDiscordFriends({ meId, query: searchQ })
        : Promise.resolve([]),
    ]);

  const circles = memberships.map((m) => m.circle);
  const today = formatDateInZone(session.user.timezone);
  const since = formatDateInZone(
    session.user.timezone,
    new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
  );
  const weekStart = formatDateInZone(
    session.user.timezone,
    new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
  );

  const boards = await Promise.all(
    circles.map(async (circle) => {
      const userIds = circle.members.map((m) => m.userId);
      const [logs, study, habitDefs] = await Promise.all([
        prisma.habitLog.findMany({
          where: { userId: { in: userIds }, date: { gte: since } },
          orderBy: { date: "asc" },
        }),
        studyMinutesByUser(userIds, weekStart),
        prisma.habit.findMany({
          where: { userId: { in: userIds }, active: true },
          select: { userId: true, key: true },
        }),
      ]);

      const byUser = new Map<string, ReturnType<typeof toClientLog>[]>();
      for (const l of logs) {
        const list = byUser.get(l.userId) || [];
        list.push(toClientLog(l));
        byUser.set(l.userId, list);
      }
      const habitKeysByUser = new Map<string, string[]>();
      for (const h of habitDefs) {
        const list = habitKeysByUser.get(h.userId) || [];
        list.push(h.key);
        habitKeysByUser.set(h.userId, list);
      }

      const members = circle.members.map((m) => {
        const userLogs = byUser.get(m.userId) || [];
        const todayLog = userLogs.find((l) => l.date === today) || null;
        const earlyStreak = computeStreak(userLogs, (l) =>
          isHabitDone(l, "wakeEarly")
        );
        const checkedIn = Boolean(todayLog?.wakeTime);
        const wakeOnTime =
          checkedIn && Boolean(todayLog && isHabitDone(todayLog, "wakeEarly"));

        const last7 = userLogs.filter((l) => l.date >= weekStart);
        const wakeDays = last7.filter((l) => isHabitDone(l, "wakeEarly")).length;
        const keys = habitKeysByUser.get(m.userId) || [];
        const habitHits = last7.reduce(
          (n, l) => n + completedCount(l, keys.length ? keys : undefined),
          0
        );
        const habitSlots = Math.max(1, keys.length) * 7;
        const habitPct = Math.round((habitHits / habitSlots) * 100);
        const todayHabits = todayLog
          ? completedCount(todayLog, keys.length ? keys : undefined)
          : 0;
        const studyWeek = study.week.get(m.userId) || 0;
        const studyTotal = study.total.get(m.userId) || 0;
        const consistency = Math.round((wakeDays / 7) * 100);
        const combined = combinedScore(habitPct, studyWeek);

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
            habitPct,
            todayHabits,
            studyWeek,
            studyTotal,
            consistency,
            combined,
            consistencyStreak: m.user.consistencyStreak,
          },
        };
      });

      const idOf = (row: (typeof members)[number]) => row.user.id;
      const ranks = {
        today: assignRanks(
          members,
          (row) =>
            (row.stats.wakeOnTime ? 1000 : row.stats.checkedIn ? 500 : 0) +
            row.stats.todayHabits,
          idOf
        ),
        habits: assignRanks(members, (row) => row.stats.habitPct, idOf),
        study: assignRanks(members, (row) => row.stats.studyWeek, idOf),
        consistency: assignRanks(
          members,
          (row) => row.stats.consistency,
          idOf
        ),
        combined: assignRanks(members, (row) => row.stats.combined, idOf),
      };

      const rankedMembers = members.map((row) => ({
        ...row,
        ranks: {
          today: ranks.today.get(row.user.id) || members.length,
          habits: ranks.habits.get(row.user.id) || members.length,
          study: ranks.study.get(row.user.id) || members.length,
          consistency: ranks.consistency.get(row.user.id) || members.length,
          combined: ranks.combined.get(row.user.id) || members.length,
        },
      }));

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
        members: rankedMembers,
      };
    })
  );

  return NextResponse.json({
    circles,
    boards,
    suggestions,
    search: searchHits,
    discordGroup,
    me: meId,
    hasDiscord: Boolean(me?.discordId),
    howTo: [
      "Create a circle, or join with an invite code / link — paste either, it just works.",
      "Easier: add anyone already on Dawn with Discord, or anyone in your same Discord server — one tap, no code.",
      "Or join the Discord server group so the whole study server shares one board.",
      "The board ranks habit consistency (7-day %) and study hours (voice rooms), plus a combined score.",
      "Owner can paste a Discord channel so the invite and check-ins post there.",
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
  const meId = session.user.id;

  if (action === "create") {
    const name = String(body.name || "Morning Circle").trim().slice(0, 60);
    const discordChannelId = body.discordChannelId
      ? normChannelId(body.discordChannelId) || null
      : normChannelId(process.env.DISCORD_CHANNEL_ID) || null;

    const circle = await prisma.accountabilityCircle.create({
      data: {
        name: name || "Morning Circle",
        inviteCode: await uniqueInviteCode(),
        ownerId: meId,
        discordChannelId,
        members: {
          create: { userId: meId },
        },
      },
      include: { members: true },
    });

    return NextResponse.json({ circle });
  }

  if (action === "join") {
    const code = parseInviteInput(String(body.inviteCode || ""));
    if (!code) {
      return NextResponse.json({ error: "Paste an invite code or link" }, { status: 400 });
    }
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
          userId: meId,
        },
      },
      create: { circleId: circle.id, userId: meId },
      update: {},
    });
    return NextResponse.json({ circle });
  }

  if (action === "joinDiscordGroup") {
    const me = await prisma.user.findUnique({
      where: { id: meId },
      select: { discordId: true },
    });
    if (!me?.discordId) {
      return NextResponse.json(
        { error: "Link Discord in Settings first, then you can join the server group." },
        { status: 400 }
      );
    }
    const enrolled = await enrollDiscordFriend({
      userId: meId,
      discordId: me.discordId,
    });
    if (!enrolled.circleId) {
      return NextResponse.json(
        {
          error:
            "No Discord server is configured yet. Use an invite code, or ask the owner to set DISCORD_GUILD_ID.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true, circleId: enrolled.circleId });
  }

  if (action === "search") {
    const hits = await searchDiscordFriends({
      meId,
      query: String(body.q || ""),
      excludeIds: Array.isArray(body.excludeIds)
        ? body.excludeIds.map(String)
        : [],
    });
    return NextResponse.json({ results: hits });
  }

  if (action === "addMember") {
    const circleId = String(body.circleId || "");
    const userId = String(body.userId || "");
    const membership = await prisma.circleMember.findUnique({
      where: { circleId_userId: { circleId, userId: meId } },
      include: {
        circle: { select: { ownerId: true, name: true, inviteCode: true } },
      },
    });
    if (!membership) {
      return NextResponse.json({ error: "Join the circle first" }, { status: 403 });
    }
    const allowed = await canAddFriendToCircle({
      meId,
      targetId: userId,
      isOwner: membership.circle.ownerId === meId,
    });
    if (!allowed.ok) {
      return NextResponse.json({ error: allowed.error }, { status: 400 });
    }
    await prisma.circleMember.upsert({
      where: { circleId_userId: { circleId, userId } },
      create: { circleId, userId },
      update: {},
    });
    const added = await prisma.user.findUnique({
      where: { id: userId },
      select: { discordId: true, name: true },
    });
    if (added?.discordId) {
      const link = inviteLink(siteOrigin(), membership.circle.inviteCode);
      await discordSendDm(added.discordId, {
        title: `You’re in ${membership.circle.name}`,
        body: `${session.user.name || "A friend"} added you to their Dawn circle. Open Friends to see habit + study ranks.\n${link}`,
      }).catch(() => null);
    }
    return NextResponse.json({ ok: true, name: added?.name || "Friend" });
  }

  if (action === "shareInvite") {
    const circleId = String(body.circleId || "");
    const membership = await prisma.circleMember.findUnique({
      where: { circleId_userId: { circleId, userId: meId } },
      include: {
        circle: true,
        user: { select: { discordChannelId: true } },
      },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not in this circle" }, { status: 403 });
    }
    const channelId =
      normChannelId(membership.circle.discordChannelId) ||
      normChannelId(membership.user.discordChannelId) ||
      normChannelId(process.env.DISCORD_CHANNEL_ID);
    if (!channelId) {
      return NextResponse.json(
        {
          error:
            "No Discord channel yet. Owner: paste a channel ID on the circle, or set one in Settings → Discord.",
        },
        { status: 400 }
      );
    }
    const code = membership.circle.inviteCode;
    const link = inviteLink(siteOrigin(), code);
    const res = await discordSendChannelMessage(channelId, {
      title: `Join ${membership.circle.name} on Dawn`,
      body: `Invite code: **${code}**\nOpen: ${link}\n\nYou’ll land on the friend board — ranked by habit consistency and study hours.`,
      content: `Dawn circle invite · \`${code}\``,
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: res.error || "Could not post invite" },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "rename") {
    const circleId = String(body.circleId || "");
    const name = String(body.name || "").trim().slice(0, 60);
    if (!name) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }
    const circle = await prisma.accountabilityCircle.findFirst({
      where: { id: circleId, ownerId: meId },
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
    const discordChannelId = normChannelId(body.discordChannelId) || null;
    const circle = await prisma.accountabilityCircle.findFirst({
      where: { id: circleId, ownerId: meId },
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
      where: { id: circleId, ownerId: meId },
    });
    if (!circle) {
      return NextResponse.json({ error: "Not found or not owner" }, { status: 403 });
    }
    const updated = await prisma.accountabilityCircle.update({
      where: { id: circleId },
      data: { inviteCode: await uniqueInviteCode() },
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
    if (circle.ownerId === meId) {
      const others = circle.members.filter((m) => m.userId !== meId);
      if (others.length === 0) {
        await prisma.accountabilityCircle.delete({ where: { id: circleId } });
        return NextResponse.json({ ok: true, deleted: true });
      }
      await prisma.$transaction([
        prisma.circleMember.delete({
          where: {
            circleId_userId: { circleId, userId: meId },
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
        circleId_userId: { circleId, userId: meId },
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "removeMember") {
    const circleId = String(body.circleId || "");
    const userId = String(body.userId || "");
    const circle = await prisma.accountabilityCircle.findFirst({
      where: { id: circleId, ownerId: meId },
    });
    if (!circle) {
      return NextResponse.json({ error: "Not found or not owner" }, { status: 403 });
    }
    if (userId === meId) {
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
        circleId_userId: { circleId, userId: meId },
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
