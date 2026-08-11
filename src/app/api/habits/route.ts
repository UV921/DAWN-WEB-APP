import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDefaultHabits } from "@/lib/ensure-habits";
import {
  computeStreak,
  formatLocalDate,
  isBeforeOrAt,
  isHabitDone,
  isPerfectDay,
  isSleepEarly,
  legacyFieldsFromChecks,
  mergeLogChecks,
  serializeChecks,
  type HabitLogLike,
} from "@/lib/habits";
import { notifyCircleCheckIn } from "@/lib/discord";
import { awardCheckInXp, levelFromXp } from "@/lib/xp";
import {
  enrichHabitsWithWindows,
  isHonestClockTime,
  resolveHabitWindow,
  isInWindow,
  nowMins,
} from "@/lib/habit-windows";
import { parseLifeJson } from "@/lib/personal-life";
import {
  challengeProgress,
  nextCalendarDate,
  nextOpenStreak,
  resolveDayMode,
} from "@/lib/daily-loop";

function toClientLog(log: {
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
  notes: string | null;
  id?: string;
  userId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}): HabitLogLike & Record<string, unknown> {
  const checks = mergeLogChecks(log);
  return {
    ...log,
    checks,
    sleepEarly: Boolean(checks.sleepEarly),
    noPhone: Boolean(checks.noPhone),
    wakeEarly: Boolean(checks.wakeEarly),
    gym: Boolean(checks.gym),
    reading: Boolean(checks.reading),
    quran: Boolean(checks.quran),
  };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wakeGoal = session.user.wakeGoal || "06:00";
  const sleepGoal = session.user.sleepGoal || "23:00";

  const habitsRaw = await ensureDefaultHabits(session.user.id);
  const habits = enrichHabitsWithWindows(habitsRaw, wakeGoal, sleepGoal);
  const habitKeys = habits.map((h) => h.key);

  const { searchParams } = new URL(req.url);
  const days = Math.min(Number(searchParams.get("days") || 60), 400);
  const since = formatLocalDate(
    new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  );

  const rawLogs = await prisma.habitLog.findMany({
    where: { userId: session.user.id, date: { gte: since } },
    orderBy: { date: "asc" },
  });
  const logs = rawLogs.map(toClientLog);

  const streaks: Record<string, { current: number; longest: number }> = {
    perfect: computeStreak(logs, (l) => isPerfectDay(l, habitKeys)),
  };
  for (const h of habits) {
    streaks[h.key] = computeStreak(logs, (l) => isHabitDone(l, h.key));
  }

  const today = formatLocalDate(new Date());
  const todayLog = logs.find((l) => l.date === today) || null;
  const tomorrow = nextCalendarDate(today);

  const profile = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      xp: true,
      level: true,
      focusHabitKey: true,
      identityLine: true,
      whyLine: true,
      totalEarlyWakes: true,
      bestWakeStreak: true,
      onboardingJson: true,
      onboardingDone: true,
      lifeJson: true,
      challengeStartDate: true,
      challengeDays: true,
      pledgeText: true,
      lastOpenDate: true,
      openStreak: true,
      bestOpenStreak: true,
    },
  });

  // Habit of opening the app — count once per day
  let openStreak = profile?.openStreak ?? 0;
  let bestOpenStreak = profile?.bestOpenStreak ?? 0;
  let lastOpenDate = profile?.lastOpenDate ?? null;
  const openNext = nextOpenStreak(lastOpenDate, openStreak, today);
  if (openNext.isNewDay) {
    openStreak = openNext.openStreak;
    lastOpenDate = openNext.lastOpenDate;
    bestOpenStreak = Math.max(bestOpenStreak, openStreak);
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        lastOpenDate,
        openStreak,
        bestOpenStreak,
      },
    });
  }

  const lvl = levelFromXp(profile?.xp ?? 0);
  const earlyStreak = computeStreak(logs, (l) => isHabitDone(l, "wakeEarly"));
  const life = parseLifeJson(profile?.lifeJson);
  const challenge = challengeProgress(
    profile?.challengeStartDate,
    today,
    profile?.challengeDays || 7
  );
  const dayMode = resolveDayMode(wakeGoal, sleepGoal);

  const [todayPlan, todayTodos, tomorrowPlan, tomorrowTodos] =
    await Promise.all([
      prisma.dayPlan.findUnique({
        where: { userId_date: { userId: session.user.id, date: today } },
      }),
      prisma.todo.findMany({
        where: { userId: session.user.id, date: today },
        orderBy: { createdAt: "asc" },
      }),
      prisma.dayPlan.findUnique({
        where: { userId_date: { userId: session.user.id, date: tomorrow } },
      }),
      prisma.todo.findMany({
        where: { userId: session.user.id, date: tomorrow },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  return NextResponse.json({
    logs,
    streaks,
    todayLog,
    today,
    tomorrow,
    habits,
    wakeGoal,
    sleepGoal,
    dayMode,
    challenge,
    todayPlan,
    todayTodos,
    tomorrowPlan,
    tomorrowTodos,
    profile: {
      ...profile,
      lifeJson: undefined,
      lifeBrief: life.brief,
      hasLifeProfile: Object.keys(life.answers).length >= 4,
      level: lvl.level,
      intoLevel: lvl.intoLevel,
      need: lvl.need,
      progress: lvl.progress,
      earlyStreak: earlyStreak.current,
      openStreak,
      bestOpenStreak,
      lastOpenDate,
      pledgeText: profile?.pledgeText || "",
      challengeStartDate: profile?.challengeStartDate || null,
      celebrate:
        (() => {
          try {
            const j = JSON.parse(profile?.onboardingJson || "{}") as {
              celebrate?: string;
            };
            return j.celebrate === "chill" ? "chill" : "big";
          } catch {
            return "big";
          }
        })(),
    },
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const habits = await ensureDefaultHabits(session.user.id);
  const habitKeys = habits.map((h) => h.key);

  const body = await req.json();
  const today = formatLocalDate(new Date());
  const date = (body.date as string) || today;
  const onlyToday = date === today;

  let wakeTime = body.wakeTime ? String(body.wakeTime) : null;
  let bedtime = body.bedtime ? String(body.bedtime) : null;
  const notes = body.notes ? String(body.notes) : null;

  const wakeGoal = session.user.wakeGoal || "06:00";
  const sleepGoal = session.user.sleepGoal || "23:00";

  const existing = await prisma.habitLog.findUnique({
    where: { userId_date: { userId: session.user.id, date } },
  });
  const prevChecks = mergeLogChecks(existing || {});
  const checks = { ...prevChecks };

  const rejected: { key: string; reason: string }[] = [];

  // Apply requested checks with window rules (only for newly completing)
  const incoming =
    typeof body.checks === "object" && body.checks
      ? (body.checks as Record<string, boolean>)
      : {};

  for (const h of habits) {
    if (typeof body[h.key] === "boolean") {
      incoming[h.key] = body[h.key];
    }
  }

  for (const h of habits) {
    if (typeof incoming[h.key] !== "boolean") continue;
    const want = incoming[h.key];
    const had = Boolean(prevChecks[h.key]);

    // Always allow unchecking
    if (!want) {
      checks[h.key] = false;
      continue;
    }
    if (had) {
      checks[h.key] = true;
      continue;
    }

    // Completing a habit — must be today + inside window
    if (!onlyToday) {
      rejected.push({
        key: h.key,
        reason: "You can only complete habits for today.",
      });
      continue;
    }

    const win = resolveHabitWindow(h, wakeGoal, sleepGoal);
    if (!isInWindow(nowMins(), win.start, win.end)) {
      rejected.push({
        key: h.key,
        reason: `Opens ${win.start}–${win.end}. Come back in that window.`,
      });
      continue;
    }
    checks[h.key] = true;
  }

  // Wake / bed: honest clock + window
  let wakeAccepted = false;
  let bedAccepted = false;

  if (wakeTime) {
    const wakeWin = resolveHabitWindow(
      { key: "wakeEarly", label: "Wake", windowStart: null, windowEnd: null },
      wakeGoal,
      sleepGoal
    );
    const customWake = habits.find((h) => h.key === "wakeEarly");
    const win = customWake
      ? resolveHabitWindow(customWake, wakeGoal, sleepGoal)
      : wakeWin;

    if (!onlyToday) {
      wakeTime = existing?.wakeTime || null;
      rejected.push({ key: "wakeTime", reason: "Wake can only be logged today." });
    } else if (existing?.wakeTime) {
      // Keep existing wake — don't overwrite with backdated pickers
      wakeTime = existing.wakeTime;
    } else if (!isInWindow(nowMins(), win.start, win.end)) {
      wakeTime = null;
      rejected.push({
        key: "wakeTime",
        reason: `Wake window is ${win.start}–${win.end}.`,
      });
    } else if (!isHonestClockTime(wakeTime)) {
      wakeTime = null;
      rejected.push({
        key: "wakeTime",
        reason: "Use “I woke up” (logs current time). No backdating.",
      });
    } else {
      wakeAccepted = true;
      checks.wakeEarly = isBeforeOrAt(wakeTime, wakeGoal);
    }
  } else if (existing?.wakeTime) {
    wakeTime = existing.wakeTime;
  }

  if (bedtime) {
    const bedHabit = habits.find((h) => h.key === "sleepEarly");
    const win = resolveHabitWindow(
      bedHabit || {
        key: "sleepEarly",
        label: "Sleep",
        windowStart: null,
        windowEnd: null,
      },
      wakeGoal,
      sleepGoal
    );

    if (!onlyToday) {
      bedtime = existing?.bedtime || null;
      rejected.push({
        key: "bedtime",
        reason: "Bedtime can only be logged today.",
      });
    } else if (existing?.bedtime) {
      bedtime = existing.bedtime;
    } else if (!isInWindow(nowMins(), win.start, win.end)) {
      bedtime = null;
      rejected.push({
        key: "bedtime",
        reason: `Sleep window is ${win.start}–${win.end}.`,
      });
    } else if (!isHonestClockTime(bedtime)) {
      bedtime = null;
      rejected.push({
        key: "bedtime",
        reason: "Use “Going to sleep” (logs current time). No backdating.",
      });
    } else {
      bedAccepted = true;
      checks.sleepEarly = isSleepEarly(bedtime, sleepGoal);
    }
  } else if (existing?.bedtime) {
    bedtime = existing.bedtime;
  }

  // If wake already set, keep wakeEarly consistent with goal
  if (wakeTime && !wakeAccepted) {
    checks.wakeEarly = isBeforeOrAt(wakeTime, wakeGoal);
  }
  if (bedtime && !bedAccepted) {
    checks.sleepEarly = isSleepEarly(bedtime, sleepGoal);
  }

  const legacy = legacyFieldsFromChecks(checks);

  const hadWake = Boolean(existing?.wakeTime);
  const firstWakeToday = Boolean(wakeTime) && !hadWake && wakeAccepted;
  const wakeEarlyNow = Boolean(checks.wakeEarly);
  const wakeEarlyNew =
    wakeEarlyNow && !prevChecks.wakeEarly && (wakeAccepted || firstWakeToday);

  const newlyDone = habitKeys.filter(
    (k) => Boolean(checks[k]) && !Boolean(prevChecks[k])
  );

  const userRow = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      focusHabitKey: true,
      xp: true,
      totalEarlyWakes: true,
      bestWakeStreak: true,
    },
  });
  const focusKey = userRow?.focusHabitKey || "wakeEarly";
  const focusDoneNew =
    Boolean(checks[focusKey]) &&
    !prevChecks[focusKey] &&
    newlyDone.includes(focusKey);
  const perfectNow = habitKeys.every((k) => Boolean(checks[k]));
  const perfectPrev = habitKeys.every((k) => Boolean(prevChecks[k]));
  const perfectNew = perfectNow && !perfectPrev;

  const log = await prisma.habitLog.upsert({
    where: { userId_date: { userId: session.user.id, date } },
    create: {
      userId: session.user.id,
      date,
      wakeTime,
      bedtime,
      checks: serializeChecks(checks),
      notes,
      ...legacy,
    },
    update: {
      wakeTime,
      bedtime,
      checks: serializeChecks(checks),
      notes,
      ...legacy,
    },
  });

  const recentRaw = await prisma.habitLog.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "asc" },
  });
  const recent = recentRaw.map(toClientLog);
  const streak = computeStreak(recent, (l) => isPerfectDay(l, habitKeys));
  const earlyStreak = computeStreak(recent, (l) => isHabitDone(l, "wakeEarly"));

  let hit: {
    xpGained: number;
    labels: string[];
    level: number;
    progress: number;
    intoLevel: number;
    need: number;
    streak: number;
    title: string;
    subtitle?: string;
  } | null = null;

  const awardHabits = newlyDone.filter((k) => k !== "wakeEarly" || wakeAccepted);
  if (firstWakeToday || wakeEarlyNew || awardHabits.length > 0 || perfectNew) {
    const award = awardCheckInXp({
      wakeLogged: firstWakeToday,
      wakeOnTime: Boolean(wakeEarlyNew || (firstWakeToday && wakeEarlyNow)),
      wakeStreak: earlyStreak.current,
      habitsNewlyDone: awardHabits.filter((k) => k !== "wakeEarly").length,
      focusDone: focusDoneNew && focusKey !== "wakeEarly",
      allDone: perfectNew,
    });
    if (award.xp > 0) {
      const newXp = (userRow?.xp ?? 0) + award.xp;
      const lvl = levelFromXp(newXp);
      const totalEarly =
        (userRow?.totalEarlyWakes ?? 0) +
        (wakeEarlyNew || (firstWakeToday && wakeEarlyNow) ? 1 : 0);
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          xp: newXp,
          level: lvl.level,
          totalEarlyWakes: totalEarly,
          bestWakeStreak: Math.max(
            userRow?.bestWakeStreak ?? 0,
            earlyStreak.current
          ),
        },
      });
      hit = {
        xpGained: award.xp,
        labels: award.labels,
        level: lvl.level,
        progress: lvl.progress,
        intoLevel: lvl.intoLevel,
        need: lvl.need,
        streak: earlyStreak.current,
        title:
          wakeEarlyNew || (firstWakeToday && wakeEarlyNow)
            ? "On-time wake"
            : perfectNew
              ? "Morning complete"
              : newlyDone.length
                ? "Habit logged"
                : "Check-in saved",
        subtitle: wakeEarlyNow
          ? "Logged in your wake window — that counts."
          : newlyDone.length
            ? "Logged while the window was open."
            : undefined,
      };
    }
  }

  void notifyCircleCheckIn(session.user.id, {
    userName: session.user.name || "Someone",
    date,
    wakeTime: log.wakeTime,
    habits: habits.map((h) => ({
      label: h.label,
      done: Boolean(checks[h.key]),
    })),
    streak: streak.current,
  });

  const enriched = enrichHabitsWithWindows(habits, wakeGoal, sleepGoal);

  return NextResponse.json({
    log: toClientLog(log),
    streak,
    habits: enriched,
    hit,
    earlyStreak: earlyStreak.current,
    rejected,
    error:
      rejected.length && !hit && newlyDone.length === 0 && !firstWakeToday
        ? rejected[0]?.reason
        : undefined,
  });
}
