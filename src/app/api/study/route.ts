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
  todayInZone,
} from "@/lib/study-time";
import { buildStudyStatus, studyStreak } from "@/lib/study-status";

function snowflake(raw: unknown): string {
  return String(raw || "").replace(/\D/g, "").slice(0, 32);
}

async function roomsForGuild(guildId: string | null) {
  const envIds = envStudyVoiceIds();
  const rows = await prisma.studyRoom.findMany({
    where: guildId ? { guildId } : undefined,
    orderBy: { createdAt: "asc" },
    select: { channelId: true, name: true, guildId: true },
  });
  const seen = new Set(rows.map((r) => r.channelId));
  const extra = envIds
    .filter((id) => !seen.has(id))
    .map((channelId) => ({
      channelId,
      name: "From .env",
      guildId: guildId || "",
    }));
  return [...rows, ...extra];
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const range = Math.min(
    30,
    Math.max(7, Number(searchParams.get("days") || 7) || 7)
  );

  const tz = session.user.timezone || DEFAULT_TZ;
  const today = todayInZone(tz);
  const rangeDates = lastNDates(today, range);
  const weekDates = rangeDates.slice(-7);
  const since = rangeDates[0];
  const guildId = process.env.DISCORD_GUILD_ID?.trim() || null;
  const now = new Date();

  const [sessions, rooms, user] = await Promise.all([
    prisma.studySession.findMany({
      where: {
        userId: session.user.id,
        OR: [{ date: { gte: since } }, { endedAt: null }],
      },
      orderBy: { startedAt: "asc" },
    }),
    roomsForGuild(guildId),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { discordId: true },
    }),
  ]);

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
    minutes: Math.round(byDate.get(date) || 0),
  }));
  const week = series.slice(-7);
  const todayMinutes = byDate.get(today) || 0;
  const weekMinutes = week.reduce((a, b) => a + b.minutes, 0);
  const monthMinutes = series.reduce((a, b) => a + b.minutes, 0);
  const live = sessions.find((s) => !s.endedAt) || null;
  const configured = rooms.length > 0;
  const weekDaysWithStudy = week.filter((d) => d.minutes > 0).length;
  const monthDaysWithStudy = series.filter((d) => d.minutes > 0).length;
  const best = [...week].sort((a, b) => b.minutes - a.minutes)[0];
  const status = buildStudyStatus({
    configured,
    hasDiscord: Boolean(user?.discordId),
    live: Boolean(live),
    todayMinutes,
    weekMinutes,
    weekDaysWithStudy,
    bestDayMinutes: best?.minutes || 0,
  });

  return NextResponse.json({
    configured,
    hasDiscord: Boolean(user?.discordId),
    rooms,
    today: {
      date: today,
      minutes: Math.round(todayMinutes),
      label: formatStudyDuration(todayMinutes),
      live: Boolean(live),
      liveStartedAt: live?.startedAt?.toISOString() || null,
    },
    week,
    weekMinutes: Math.round(weekMinutes),
    weekLabel: formatStudyDuration(weekMinutes),
    weekDaysWithStudy,
    month: series,
    monthMinutes: Math.round(monthMinutes),
    monthLabel: formatStudyDuration(monthMinutes),
    monthDaysWithStudy,
    streak: studyStreak(series),
    bestDay: best
      ? { date: best.date, minutes: best.minutes, label: formatStudyDuration(best.minutes) }
      : null,
    status,
    hint: status.body,
  });
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
