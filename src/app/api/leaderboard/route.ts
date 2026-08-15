import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  computeStreak,
  completedCount,
  formatLocalDate,
  isHabitDone,
  mergeLogChecks,
} from "@/lib/habits";
import { enrollDiscordFriend } from "@/lib/discord-enroll";

export type LeaderboardMetric =
  | "earlyStreak"
  | "openStreak"
  | "xp"
  | "consistency"
  | "totalEarly"
  | "studyWeek"
  | "studyTotal"
  | "habits";

type Scope = "discord" | "global" | "circle";

function toLog(l: {
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
  return { ...l, checks: mergeLogChecks(l) };
}

/** Ensure this web user is on the Dawn Discord board for their guild. */
async function ensureOnDiscordBoard(userId: string, discordId: string | null) {
  await enrollDiscordFriend({ userId, discordId });
}

/**
 * Close Discord circle:
 * people who logged into Dawn AND share the same Dawn Discord server board.
 */
async function resolveDiscordCircleUserIds(meId: string): Promise<{
  userIds: string[];
  guildIds: string[];
  boardName: string | null;
  emptyReason?: string;
}> {
  const me = await prisma.user.findUnique({
    where: { id: meId },
    select: { discordId: true },
  });

  if (!me?.discordId) {
    return {
      userIds: [meId],
      guildIds: [],
      boardName: null,
      emptyReason:
        "Link Discord in Settings → Discord. Then everyone on your Dawn Discord server who logs into Dawn shows here.",
    };
  }

  await ensureOnDiscordBoard(meId, me.discordId);

  const envGuild = process.env.DISCORD_GUILD_ID?.trim();

  // Guilds I'm already tracked in
  const myTracks = await prisma.trackedMember.findMany({
    where: { userId: meId },
    include: { channel: { select: { guildId: true, name: true, id: true } } },
  });

  const guildIds = [
    ...new Set(
      [
        ...myTracks.map((t) => t.channel.guildId),
        ...(envGuild ? [envGuild] : []),
      ].filter(Boolean)
    ),
  ];

  if (guildIds.length === 0) {
    // Fallback: all Discord-linked Dawn users (single-server apps)
    const linked = await prisma.user.findMany({
      where: { discordId: { not: null }, onboardingDone: true },
      select: { id: true },
      take: 200,
    });
    const ids = [...new Set([meId, ...linked.map((u) => u.id)])];
    return {
      userIds: ids,
      guildIds: [],
      boardName: "Discord-linked Dawn users",
      emptyReason:
        ids.length <= 1
          ? "You’re the only Discord-linked user so far. Friends must log into Dawn with Discord."
          : undefined,
    };
  }

  const channels = await prisma.trackedChannel.findMany({
    where: { guildId: { in: guildIds } },
    select: { id: true, name: true, guildId: true },
  });

  const trackedMembers = await prisma.trackedMember.findMany({
    where: { trackedChannelId: { in: channels.map((c) => c.id) } },
    select: { userId: true },
  });

  const trackedIds = new Set(trackedMembers.map((m) => m.userId));
  trackedIds.add(meId);

  // Also pull anyone who logged into Dawn with Discord and is already a User
  // linked via tracked membership — already covered.
  // Plus: Discord-linked users who share this app's guild intent (onboarding done)
  // only if they're tracked OR have discordId and we're on the env guild.
  if (envGuild && guildIds.includes(envGuild)) {
    const discordUsers = await prisma.user.findMany({
      where: {
        discordId: { not: null },
        OR: [{ onboardingDone: true }, { id: meId }],
      },
      select: { id: true, discordId: true },
      take: 300,
    });
    // Prefer people who are on the tracked board; if board is tiny, include all discord-linked
    const onBoard = discordUsers.filter((u) => trackedIds.has(u.id));
    if (onBoard.length >= 2) {
      return {
        userIds: [...new Set(onBoard.map((u) => u.id))],
        guildIds,
        boardName: channels[0]?.name || "Dawn Discord",
      };
    }
    // Board sparse — show all Discord-linked app users (same Dawn Discord product)
    return {
      userIds: [...new Set([meId, ...discordUsers.map((u) => u.id)])],
      guildIds,
      boardName: channels[0]?.name || "Dawn Discord",
    };
  }

  const ids = [...trackedIds];
  return {
    userIds: ids,
    guildIds,
    boardName: channels[0]?.name || "Dawn Discord",
    emptyReason:
      ids.length <= 1
        ? "Only you on this Discord board so far. Friends: Join Dawn board in Discord + log into the app with Discord."
        : undefined,
  };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meRow = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { discordId: true },
  });

  const { searchParams } = new URL(req.url);
  const metric = (searchParams.get("metric") ||
    "earlyStreak") as LeaderboardMetric;
  const defaultScope: Scope = meRow?.discordId ? "discord" : "global";
  const scope = (searchParams.get("scope") || defaultScope) as Scope;
  const circleId = searchParams.get("circleId") || "";

  const since = formatLocalDate(
    new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
  );
  const weekStart = formatLocalDate(
    new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
  );
  const today = formatLocalDate(new Date());

  let userIds: string[] | null = null;
  let emptyReason: string | undefined;
  let discordBoardName: string | null = null;
  let discordGuildIds: string[] = [];

  const myMemberships = await prisma.circleMember.findMany({
    where: { userId: session.user.id },
    include: { circle: { select: { id: true, name: true } } },
  });
  const circles = myMemberships.map((m) => m.circle);

  if (scope === "discord") {
    const resolved = await resolveDiscordCircleUserIds(session.user.id);
    userIds = resolved.userIds;
    emptyReason = resolved.emptyReason;
    discordBoardName = resolved.boardName;
    discordGuildIds = resolved.guildIds;
  } else if (scope === "circle") {
    const targetCircleId = circleId || circles[0]?.id;
    if (!targetCircleId) {
      return NextResponse.json({
        rows: [],
        metric,
        scope,
        circles,
        today,
        hasDiscord: Boolean(meRow?.discordId),
        emptyReason: "Join or create a friend circle first.",
      });
    }
    const inCircle = await prisma.circleMember.findFirst({
      where: { circleId: targetCircleId, userId: session.user.id },
    });
    if (!inCircle) {
      return NextResponse.json({ error: "Not in that circle" }, { status: 403 });
    }
    const members = await prisma.circleMember.findMany({
      where: { circleId: targetCircleId },
      select: { userId: true },
    });
    userIds = members.map((m) => m.userId);
  }

  const users = await prisma.user.findMany({
    where: userIds
      ? { id: { in: userIds } }
      : { onboardingDone: true },
    select: {
      id: true,
      name: true,
      image: true,
      discordId: true,
      xp: true,
      level: true,
      openStreak: true,
      bestOpenStreak: true,
      totalEarlyWakes: true,
      bestWakeStreak: true,
      wakeGoal: true,
      consistencyStreak: true,
    },
    take: 200,
  });

  const logs = await prisma.habitLog.findMany({
    where: {
      userId: { in: users.map((u) => u.id) },
      date: { gte: since },
    },
    orderBy: { date: "asc" },
  });

  const logsByUser = new Map<string, ReturnType<typeof toLog>[]>();
  for (const l of logs) {
    const list = logsByUser.get(l.userId) || [];
    list.push(toLog(l));
    logsByUser.set(l.userId, list);
  }

  const userIdsForStudy = users.map((u) => u.id);
  const [studyWeekRows, studyAllRows, openSessions, habitDefs] = await Promise.all([
    prisma.studySession.groupBy({
      by: ["userId"],
      where: {
        userId: { in: userIdsForStudy },
        endedAt: { not: null },
        date: { gte: weekStart },
      },
      _sum: { minutes: true },
    }),
    prisma.studySession.groupBy({
      by: ["userId"],
      where: {
        userId: { in: userIdsForStudy },
        endedAt: { not: null },
      },
      _sum: { minutes: true },
    }),
    prisma.studySession.findMany({
      where: { userId: { in: userIdsForStudy }, endedAt: null },
      select: { userId: true, startedAt: true, date: true },
    }),
    prisma.habit.findMany({
      where: { userId: { in: userIdsForStudy }, active: true },
      select: { userId: true, key: true },
    }),
  ]);

  const studyWeekMap = new Map<string, number>();
  const studyTotalMap = new Map<string, number>();
  for (const r of studyWeekRows) {
    studyWeekMap.set(r.userId, r._sum.minutes || 0);
  }
  for (const r of studyAllRows) {
    studyTotalMap.set(r.userId, r._sum.minutes || 0);
  }
  const now = Date.now();
  for (const s of openSessions) {
    const extra = Math.max(
      0,
      Math.round((now - s.startedAt.getTime()) / 60_000)
    );
    studyTotalMap.set(s.userId, (studyTotalMap.get(s.userId) || 0) + extra);
    if (s.date >= weekStart) {
      studyWeekMap.set(s.userId, (studyWeekMap.get(s.userId) || 0) + extra);
    }
  }
  const habitKeysByUser = new Map<string, string[]>();
  for (const h of habitDefs) {
    const list = habitKeysByUser.get(h.userId) || [];
    list.push(h.key);
    habitKeysByUser.set(h.userId, list);
  }

  const rows = users.map((u) => {
    const ulogs = logsByUser.get(u.id) || [];
    const earlyStreak = computeStreak(ulogs, (l) =>
      isHabitDone(l, "wakeEarly")
    ).current;
    const week = ulogs.filter((l) => l.date >= weekStart);
    const wakeOnTime7 = week.filter((l) => isHabitDone(l, "wakeEarly")).length;
    const checkedIn7 = week.filter((l) => Boolean(l.wakeTime)).length;
    const consistency =
      week.length === 0 ? 0 : Math.round((wakeOnTime7 / 7) * 100);
    const todayLog = ulogs.find((l) => l.date === today);
    const upToday = Boolean(todayLog?.wakeTime);
    const onTimeToday = Boolean(todayLog && isHabitDone(todayLog, "wakeEarly"));
    const keys = habitKeysByUser.get(u.id) || [];
    const habitHits = week.reduce(
      (n, l) => n + completedCount(l, keys.length ? keys : undefined),
      0
    );
    const habitSlots = Math.max(1, keys.length) * 7;
    const habitPct = Math.round((habitHits / habitSlots) * 100);

    const scores: Record<LeaderboardMetric, number> = {
      earlyStreak,
      openStreak: u.openStreak,
      xp: u.xp,
      consistency,
      totalEarly: u.totalEarlyWakes,
      studyWeek: studyWeekMap.get(u.id) || 0,
      studyTotal: studyTotalMap.get(u.id) || 0,
      habits: habitPct,
    };

    return {
      userId: u.id,
      name: u.name || "Dawn user",
      image: u.image,
      hasDiscord: Boolean(u.discordId),
      level: u.level,
      wakeGoal: u.wakeGoal,
      upToday,
      onTimeToday,
      earlyStreak,
      openStreak: u.openStreak,
      bestOpenStreak: u.bestOpenStreak,
      bestWakeStreak: u.bestWakeStreak,
      xp: u.xp,
      totalEarlyWakes: u.totalEarlyWakes,
      consistencyStreak: u.consistencyStreak,
      wakeOnTime7,
      checkedIn7,
      consistency,
      studyWeek: studyWeekMap.get(u.id) || 0,
      studyTotal: studyTotalMap.get(u.id) || 0,
      habits: habitPct,
      score: scores[metric] ?? earlyStreak,
      isMe: u.id === session.user.id,
    };
  });

  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.xp !== a.xp) return b.xp - a.xp;
    return a.name.localeCompare(b.name);
  });

  const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));
  const me = ranked.find((r) => r.isMe) || null;

  return NextResponse.json({
    rows: ranked.slice(0, 50),
    me,
    metric,
    scope,
    circles,
    circleId:
      scope === "circle" ? circleId || circles[0]?.id || null : null,
    today,
    hasDiscord: Boolean(meRow?.discordId),
    discordBoardName,
    discordGuildIds,
    emptyReason:
      emptyReason ||
      (ranked.length === 0
        ? "No one on this board yet."
        : undefined),
    labels: {
      earlyStreak: "Early wake streak",
      openStreak: "Open Dawn streak",
      xp: "Total XP",
      consistency: "7-day on-time %",
      totalEarly: "Lifetime early wakes",
      studyWeek: "Study hours this week",
      studyTotal: "Study hours all time",
      habits: "Habit completion · 7 days",
    },
    scoreKind:
      metric === "studyWeek" || metric === "studyTotal"
        ? "duration"
        : metric === "consistency" || metric === "habits"
          ? "percent"
          : "number",
  });
}
