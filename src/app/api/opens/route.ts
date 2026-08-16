import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateInZone, zonedClock } from "@/lib/clock";
import { nextOpenStreak } from "@/lib/daily-loop";

const SOURCES = new Set([
  "visibility",
  "focus",
  "cold",
  "motion",
  "resume",
]);

function nowHHMM(timeZone?: string) {
  return zonedClock(timeZone).hhmm;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = formatDateInZone(session.user.timezone);
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || today;

  const [opens, user] = await Promise.all([
    prisma.appOpen.findMany({
      where: { userId: session.user.id, date },
      orderBy: { createdAt: "asc" },
      take: 40,
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        lastOpenAt: true,
        firstOpenTimeToday: true,
        lastOpenDate: true,
        openStreak: true,
        bestOpenStreak: true,
        wakeGoal: true,
      },
    }),
  ]);

  return NextResponse.json({
    today,
    date,
    opens,
    firstOpenTimeToday:
      user?.lastOpenDate === today ? user.firstOpenTimeToday : null,
    lastOpenAt: user?.lastOpenAt,
    openStreak: user?.openStreak ?? 0,
    bestOpenStreak: user?.bestOpenStreak ?? 0,
    wakeGoal: user?.wakeGoal,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const source = SOURCES.has(String(body.source))
    ? String(body.source)
    : "visibility";
  const standalone = Boolean(body.standalone);
  const today = formatDateInZone(session.user.timezone);
  const time =
    typeof body.time === "string" && /^\d{2}:\d{2}$/.test(body.time)
      ? body.time
      : nowHHMM(session.user.timezone);
  const iso = new Date().toISOString();

  // Debounce: ignore duplicate opens within 90s from same source
  const recent = await prisma.appOpen.findFirst({
    where: {
      userId: session.user.id,
      date: today,
      source,
      createdAt: { gte: new Date(Date.now() - 90_000) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    return NextResponse.json({ ok: true, debounced: true, open: recent });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      lastOpenDate: true,
      openStreak: true,
      bestOpenStreak: true,
      firstOpenTimeToday: true,
    },
  });

  const openNext = nextOpenStreak(
    user?.lastOpenDate,
    user?.openStreak ?? 0,
    today
  );
  const firstOpen =
    openNext.isNewDay || !user?.firstOpenTimeToday
      ? time
      : user.firstOpenTimeToday;

  const [open] = await prisma.$transaction([
    prisma.appOpen.create({
      data: {
        userId: session.user.id,
        date: today,
        time,
        source,
        standalone,
      },
    }),
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        lastOpenAt: iso,
        lastOpenDate: openNext.lastOpenDate,
        openStreak: openNext.openStreak,
        bestOpenStreak: Math.max(
          user?.bestOpenStreak ?? 0,
          openNext.openStreak
        ),
        firstOpenTimeToday: firstOpen,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    open,
    firstOpenTimeToday: firstOpen,
    openStreak: openNext.openStreak,
    isNewDay: openNext.isNewDay,
  });
}
