import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TZ } from "@/lib/clock";
import {
  envStudyVoiceIds,
  formatStudyDuration,
  lastNDates,
  MIN_SESSION_MS,
  parseStudyVoiceIds,
  sessionMinutes,
  startOfMonth,
  startOfYear,
  todayInZone,
} from "@/lib/study-time";
import { buildStudyStatus, studyStreak } from "@/lib/study-status";
import {
  isWebStudySession,
  normalizeStudyActivity,
  WEB_STUDY_CHANNEL,
  WEB_STUDY_GUILD,
  studyActivityLabel,
} from "@/lib/study-activity";

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
  const lite = searchParams.get("lite") === "1";
  const range = Math.min(
    365,
    Math.max(7, Number(searchParams.get("days") || 7) || 7)
  );

  const tz = session.user.timezone || DEFAULT_TZ;
  const today = todayInZone(tz);
  const rangeDates = lastNDates(today, range);
  const weekDates = lastNDates(today, 7);
  const monthStart = startOfMonth(today);
  const yearStart = startOfYear(today);
  const weekStart = weekDates[0];
  const since = rangeDates[0];
  const guildId = process.env.DISCORD_GUILD_ID?.trim() || null;
  const now = new Date();
  const groupSince = lite ? weekStart : since < yearStart ? since : yearStart;

  const [closedSums, allSum, open, rooms, roomCount] = await Promise.all([
    prisma.studySession.groupBy({
      by: ["date"],
      where: {
        userId: session.user.id,
        endedAt: { not: null },
        date: { gte: groupSince },
      },
      _sum: { minutes: true },
    }),
    lite
      ? Promise.resolve({ _sum: { minutes: 0 } })
      : prisma.studySession.aggregate({
          where: { userId: session.user.id, endedAt: { not: null } },
          _sum: { minutes: true },
        }),
    prisma.studySession.findFirst({
      where: { userId: session.user.id, endedAt: null },
    }),
    lite ? Promise.resolve([]) : roomsForGuild(guildId),
    lite
      ? prisma.studyRoom.count()
      : Promise.resolve(0),
  ]);

  const closedByDate = new Map<string, number>();
  for (const row of closedSums) {
    closedByDate.set(row.date, row._sum.minutes || 0);
  }
  if (open) {
    const liveExtra = sessionMinutes(open.startedAt, now);
    closedByDate.set(open.date, (closedByDate.get(open.date) || 0) + liveExtra);
  }

  function sumSince(gte: string | null) {
    let n = 0;
    for (const [date, mins] of closedByDate) {
      if (!gte || date >= gte) n += mins;
    }
    return n;
  }

  const series = rangeDates.map((date) => ({
    date,
    minutes: Math.round(closedByDate.get(date) || 0),
  }));
  const week = lastNDates(today, 7).map((date) => ({
    date,
    minutes: Math.round(closedByDate.get(date) || 0),
  }));
  const todayMinutes = Math.round(closedByDate.get(today) || 0);
  const weekMinutes = week.reduce((n, d) => n + d.minutes, 0);
  const monthMinutes = sumSince(monthStart);
  const yearMinutes = lite ? weekMinutes : sumSince(yearStart);
  const allMinutes = lite
    ? weekMinutes
    : Math.round(allSum._sum.minutes || 0) +
      (open ? sessionMinutes(open.startedAt, now) : 0);
  const live = open;
  const configured = lite
    ? roomCount > 0 || envStudyVoiceIds().length > 0
    : rooms.length > 0;
  const weekDaysWithStudy = week.filter((d) => d.minutes > 0).length;
  const monthDaysWithStudy = [...closedByDate.entries()].filter(
    ([d, m]) => d >= monthStart && m > 0
  ).length;
  const best = [...week].sort((a, b) => b.minutes - a.minutes)[0];
  const hasDiscord = Boolean(session.user.discordId);
  const liveActivity = live ? studyActivityLabel(live) : null;
  const status = buildStudyStatus({
    configured,
    hasDiscord,
    live: Boolean(live),
    todayMinutes,
    weekMinutes,
    weekDaysWithStudy,
    bestDayMinutes: best?.minutes || 0,
    activity: liveActivity,
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
      activity: liveActivity,
      activityKey: live?.activityKey || null,
      source: live ? (isWebStudySession(live) ? "web" : "discord") : null,
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

  const parsed = normalizeStudyActivity({
    key: body.activityKey ?? body.key,
    text: body.activity ?? body.text ?? body.what,
  });

  if (action === "set-activity") {
    if (!parsed) {
      return NextResponse.json(
        { error: "Pick Coding, or write what you’re doing." },
        { status: 400 }
      );
    }
    const open = await prisma.studySession.findFirst({
      where: { userId: session.user.id, endedAt: null },
      orderBy: { startedAt: "desc" },
    });
    if (!open) {
      return NextResponse.json(
        { error: "No live session. Join a study room or tap Start." },
        { status: 400 }
      );
    }
    await prisma.studySession.update({
      where: { id: open.id },
      data: {
        activityKey: parsed.key,
        activity: parsed.label,
        activityAskedAt: open.activityAskedAt || new Date(),
      },
    });
    return NextResponse.json({
      ok: true,
      activity: parsed.label,
      activityKey: parsed.key,
    });
  }

  if (action === "start") {
    const tz = session.user.timezone || DEFAULT_TZ;
    const existing = await prisma.studySession.findFirst({
      where: { userId: session.user.id, endedAt: null },
      orderBy: { startedAt: "desc" },
    });
    if (existing) {
      if (parsed) {
        await prisma.studySession.update({
          where: { id: existing.id },
          data: {
            activityKey: parsed.key,
            activity: parsed.label,
            activityAskedAt: existing.activityAskedAt || new Date(),
          },
        });
      }
      return NextResponse.json({
        ok: true,
        live: true,
        activity: parsed?.label || studyActivityLabel(existing),
        activityKey: parsed?.key || existing.activityKey,
      });
    }
    const created = await prisma.studySession.create({
      data: {
        userId: session.user.id,
        guildId: WEB_STUDY_GUILD,
        channelId: WEB_STUDY_CHANNEL,
        source: "web",
        date: todayInZone(tz),
        startedAt: new Date(),
        activityKey: parsed?.key || null,
        activity: parsed?.label || null,
        activityAskedAt: parsed ? new Date() : null,
      },
    });
    return NextResponse.json({
      ok: true,
      live: true,
      activity: studyActivityLabel(created),
      activityKey: created.activityKey,
    });
  }

  if (action === "stop") {
    const open = await prisma.studySession.findFirst({
      where: { userId: session.user.id, endedAt: null },
      orderBy: { startedAt: "desc" },
    });
    if (!open) {
      return NextResponse.json({ ok: true, live: false });
    }
    if (!isWebStudySession(open)) {
      return NextResponse.json(
        {
          error:
            "Leave the study voice channel to stop. You can still change what you’re doing here.",
        },
        { status: 400 }
      );
    }
    const now = new Date();
    const elapsed = now.getTime() - open.startedAt.getTime();
    if (elapsed < MIN_SESSION_MS) {
      await prisma.studySession.delete({ where: { id: open.id } }).catch(() => undefined);
      return NextResponse.json({ ok: true, live: false, dropped: true });
    }
    const minutes = sessionMinutes(open.startedAt, now);
    await prisma.studySession.update({
      where: { id: open.id },
      data: { endedAt: now, minutes },
    });
    return NextResponse.json({ ok: true, live: false, minutes });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
