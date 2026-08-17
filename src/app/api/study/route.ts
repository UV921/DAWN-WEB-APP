import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TZ } from "@/lib/clock";
import {
  envStudyVoiceIds,
  formatStudyDuration,
  lastNDates,
  minutesOnLocalDate,
  parseStudyVoiceIds,
  sessionMinutes,
  startOfMonth,
  startOfYear,
  todayInZone,
} from "@/lib/study-time";
import { buildStudyStatus, studyStreak } from "@/lib/study-status";

function snowflake(raw: unknown): string {
  return String(raw || "").replace(/\D/g, "").slice(0, 32);
}

async function roomsForGuild(guildId: string | null) {
  const envIds = envStudyVoiceIds();
  const rows = await prisma.studyRoom.findMany({
    orderBy: { createdAt: "asc" },
    select: { channelId: true, name: true, guildId: true },
  });
  const scoped =
    guildId && rows.some((r) => r.guildId === guildId)
      ? [
          ...rows.filter((r) => r.guildId === guildId),
          ...rows.filter((r) => r.guildId !== guildId),
        ]
      : rows;
  const seen = new Set(rows.map((r) => r.channelId));
  const extra = envIds
    .filter((id) => !seen.has(id))
    .map((channelId) => ({
      channelId,
      name: "From .env",
      guildId: guildId || "",
    }));
  return [...scoped, ...extra];
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const range = Math.min(
    365,
    Math.max(7, Number(searchParams.get("days") || 7) || 7)
  );

  const tz = session.user.timezone || DEFAULT_TZ;
  const today = todayInZone(tz);
  const rangeDates = lastNDates(today, range);
  const weekDates = rangeDates.slice(-7);
  const monthStart = startOfMonth(today);
  const yearStart = startOfYear(today);
  const weekStart = weekDates[0];
  const guildId = process.env.DISCORD_GUILD_ID?.trim() || null;
  const now = new Date();

  const [sessions, rooms, user, closedSums, open] = await Promise.all([
    prisma.studySession.findMany({
      where: {
        userId: session.user.id,
        OR: [{ date: { gte: weekStart } }, { endedAt: null }],
      },
      orderBy: { startedAt: "asc" },
    }),
    roomsForGuild(guildId),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        discordId: true,
        accounts: {
          where: { provider: "discord" },
          select: { id: true },
        },
      },
    }),
    prisma.studySession.groupBy({
      by: ["date"],
      where: {
        userId: session.user.id,
        endedAt: { not: null },
      },
      _sum: { minutes: true },
    }),
    prisma.studySession.findFirst({
      where: { userId: session.user.id, endedAt: null },
    }),
  ]);

  const closedByDate = new Map<string, number>();
  for (const row of closedSums) {
    closedByDate.set(row.date, row._sum.minutes || 0);
  }
  let liveExtra = 0;
  let liveDate = today;
  if (open) {
    liveExtra = sessionMinutes(open.startedAt, now);
    liveDate = open.date;
    closedByDate.set(liveDate, (closedByDate.get(liveDate) || 0) + liveExtra);
  }

  function sumSince(gte: string | null) {
    let n = 0;
    for (const [date, mins] of closedByDate) {
      if (!gte || date >= gte) n += mins;
    }
    return n;
  }

  const byDate = new Map<string, number>();
  for (const d of rangeDates) byDate.set(d, 0);
  for (const s of sessions) {
    const end = s.endedAt || now;
    for (const d of rangeDates) {
      byDate.set(
        d,
        (byDate.get(d) || 0) +
          minutesOnLocalDate({
            startedAt: s.startedAt,
            endedAt: end,
            date: d,
            timeZone: tz,
          })
      );
    }
  }

  const series = rangeDates.map((date) => ({
    date,
    minutes: Math.round(
      closedByDate.get(date) || byDate.get(date) || 0
    ),
  }));
  const week = series.slice(-7);
  const todayMinutes = Math.round(
    Math.max(closedByDate.get(today) || 0, byDate.get(today) || 0)
  );
  const weekMinutes = sumSince(weekStart);
  const monthMinutes = sumSince(monthStart);
  const yearMinutes = sumSince(yearStart);
  const allMinutes = sumSince(null);
  const live = open;
  const configured = rooms.length > 0;
  const weekDaysWithStudy = week.filter((d) => d.minutes > 0).length;
  const monthDaysWithStudy = [...closedByDate.entries()].filter(
    ([d, m]) => d >= monthStart && m > 0
  ).length;
  const best = [...week].sort((a, b) => b.minutes - a.minutes)[0];
  const hasDiscord = Boolean(user?.discordId || user?.accounts?.length);
  const status = buildStudyStatus({
    configured,
    hasDiscord,
    live: Boolean(live),
    todayMinutes,
    weekMinutes,
    weekDaysWithStudy,
    bestDayMinutes: best?.minutes || 0,
  });

  const periods = {
    today: { minutes: todayMinutes, label: formatStudyDuration(todayMinutes) },
    week: { minutes: Math.round(weekMinutes), label: formatStudyDuration(weekMinutes) },
    month: { minutes: Math.round(monthMinutes), label: formatStudyDuration(monthMinutes) },
    year: { minutes: Math.round(yearMinutes), label: formatStudyDuration(yearMinutes) },
    all: { minutes: Math.round(allMinutes), label: formatStudyDuration(allMinutes) },
  };

  return NextResponse.json(
    {
    configured,
    hasDiscord,
    rooms,
    today: {
      date: today,
      minutes: todayMinutes,
      label: periods.today.label,
      live: Boolean(live),
      liveStartedAt: live?.startedAt?.toISOString() || null,
    },
    days: series,
    week,
    weekMinutes: periods.week.minutes,
    weekLabel: periods.week.label,
    weekDaysWithStudy,
    month: series,
    monthMinutes: periods.month.minutes,
    monthLabel: periods.month.label,
    monthDaysWithStudy,
    yearMinutes: periods.year.minutes,
    yearLabel: periods.year.label,
    allMinutes: periods.all.minutes,
    allLabel: periods.all.label,
    periods,
    streak: studyStreak(series),
    bestDay: best
      ? { date: best.date, minutes: best.minutes, label: formatStudyDuration(best.minutes) }
      : null,
    status,
    hint: status.body,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const guildId =
    snowflake(body.guildId) || process.env.DISCORD_GUILD_ID?.trim() || "";

  if (action === "add-room") {
    const ids = parseStudyVoiceIds(
      Array.isArray(body.channelIds)
        ? (body.channelIds as unknown[]).join(",")
        : String(body.channelId || body.channelIds || "")
    );
    if (!ids.length) {
      return NextResponse.json(
        { error: "Paste one or more voice channel IDs." },
        { status: 400 }
      );
    }
    if (!guildId) {
      return NextResponse.json(
        { error: "Set DISCORD_GUILD_ID or pass a server ID." },
        { status: 400 }
      );
    }
    await prisma.$transaction(
      ids.map((channelId) =>
        prisma.studyRoom.upsert({
          where: { channelId },
          create: {
            guildId,
            channelId,
            name: "Study",
            addedById: session.user.discordId || session.user.id,
          },
          update: { guildId },
        })
      )
    );
    const rooms = await roomsForGuild(guildId);
    return NextResponse.json({ ok: true, rooms });
  }

  if (action === "remove-room") {
    const channelId = snowflake(body.channelId);
    if (!channelId) {
      return NextResponse.json({ error: "channelId required" }, { status: 400 });
    }
    await prisma.studyRoom.deleteMany({ where: { channelId } });
    const rooms = await roomsForGuild(guildId || null);
    return NextResponse.json({ ok: true, rooms });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
