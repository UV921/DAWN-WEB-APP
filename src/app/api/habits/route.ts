import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDefaultHabits } from "@/lib/ensure-habits";
import {
  computeStreak,
  formatLocalDate,
  isBeforeOrAt,
  isHabitComplete,
  isHabitDone,
  isPerfectDay,
  legacyFieldsFromChecks,
  mergeLogChecks,
  serializeChecks,
  type HabitLogLike,
} from "@/lib/habits";
import { notifyCircleCheckIn } from "@/lib/discord";
import { awardCheckInXp, levelFromXp } from "@/lib/xp";
import {
  enrichHabitsWithWindows,
  effectiveWakeGoal,
  isHonestClockTime,
  resolveHabitWindow,
  isInWindow,
  isLeftoverOvernightSleep,
  nowMins,
} from "@/lib/habit-windows";
import {
  challengeProgress,
  nextCalendarDate,
  resolveDayMode,
} from "@/lib/daily-loop";
import { parseLifeJson } from "@/lib/personal-life";
import { formatDateInZone, DEFAULT_TZ } from "@/lib/clock";
import { summarizeWeek } from "@/lib/morning-pulse";

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

  const settingsWake = session.user.wakeGoal || "06:00";
  const sleepGoal = session.user.sleepGoal || "23:00";
  const tz = session.user.timezone || DEFAULT_TZ;
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const lite = searchParams.get("lite") === "1";
  const days = Math.min(
    Number(searchParams.get("days") || (lite ? 42 : 60)),
    lite ? 90 : 400
  );
  const today = formatDateInZone(tz);
  const since = formatLocalDate(
    new Date(Date.now() - days * 24 * 60 * 60 * 1000),
    tz
  );

  const [habitsRaw, rawLogs, profile, todayPlan, todayTodos, todoHistory] =
    await Promise.all([
      ensureDefaultHabits(userId),
      prisma.habitLog.findMany({
        where: { userId, date: { gte: since } },
        orderBy: { date: "asc" },
        select: {
          date: true,
          wakeTime: true,
          bedtime: true,
          checks: true,
          sleepEarly: true,
          noPhone: true,
          wakeEarly: true,
          gym: true,
          reading: true,
          quran: true,
          notes: true,
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
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
          challengeStartDate: true,
          challengeDays: true,
          pledgeText: true,
          lastOpenDate: true,
          openStreak: true,
          bestOpenStreak: true,
          lifeJson: true,
        },
      }),
      prisma.dayPlan.findUnique({
        where: { userId_date: { userId, date: today } },
      }),
      prisma.todo.findMany({
        where: { userId, date: today },
        orderBy: { createdAt: "asc" },
      }),
      lite
        ? Promise.resolve([] as { date: string; done: boolean }[])
        : prisma.todo.findMany({
            where: { userId, date: { gte: since } },
            select: { date: true, done: true },
          }),
    ]);

  const wakeGoal = effectiveWakeGoal(todayPlan?.wakeGoal, settingsWake);
  const habits = enrichHabitsWithWindows(
    habitsRaw,
    wakeGoal,
    sleepGoal,
    new Date(),
    tz
  );
  const habitKeys = habits.map((h) => h.key);
  const logs = rawLogs.map(toClientLog);

  const streaks: Record<string, { current: number; longest: number }> = {
    perfect: computeStreak(logs, (l) => isPerfectDay(l, habitKeys)),
  };
  for (const h of habits) {
    streaks[h.key] = computeStreak(logs, (l) => isHabitComplete(l, h.key));
  }

  const todayLog = logs.find((l) => l.date === today) || null;
  const lvl = levelFromXp(profile?.xp ?? 0);
  const earlyStreak = computeStreak(logs, (l) => isHabitDone(l, "wakeEarly"));
  const challenge = challengeProgress(
    profile?.challengeStartDate,
    today,
    profile?.challengeDays || 7
  );
  const life = parseLifeJson(profile?.lifeJson);
  const weekPulse = summarizeWeek(logs, habitKeys, 7);
  const todoByDate = new Map<string, { total: number; done: number }>();
  for (const t of todoHistory) {
    const cur = todoByDate.get(t.date) || { total: 0, done: 0 };
    cur.total += 1;
    if (t.done) cur.done += 1;
    todoByDate.set(t.date, cur);
  }
  const todoStats = [...todoByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  return NextResponse.json({
    logs: lite ? undefined : logs,
    streaks,
    todayLog,
    today,
    tomorrow: nextCalendarDate(today),
    habits,
    wakeGoal: settingsWake,
    todayWakeGoal: wakeGoal,
    sleepGoal,
    timezone: tz,
    dayMode: resolveDayMode(wakeGoal, sleepGoal),
    challenge,
    todayPlan,
    todayTodos,
    morningFlow: todayPlan?.morningFlow || "none",
    weekPulse,
    todoStats: lite ? undefined : todoStats,
    profile: {
      xp: profile?.xp ?? 0,
      focusHabitKey: profile?.focusHabitKey,
      identityLine: profile?.identityLine,
      whyLine: profile?.whyLine,
      totalEarlyWakes: profile?.totalEarlyWakes,
      bestWakeStreak: profile?.bestWakeStreak,
      onboardingDone: profile?.onboardingDone,
      todayAngle: life.brief?.todayAngle || "",
      hasLifeProfile: Boolean(life.brief),
      level: lvl.level,
      intoLevel: lvl.intoLevel,
      need: lvl.need,
      progress: lvl.progress,
      earlyStreak: earlyStreak.current,
      openStreak: profile?.openStreak ?? 0,
      bestOpenStreak: profile?.bestOpenStreak ?? 0,
      lastOpenDate: profile?.lastOpenDate ?? null,
      pledgeText: profile?.pledgeText || "",
      challengeStartDate: profile?.challengeStartDate || null,
      celebrate: (() => {
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
  const today = formatDateInZone(session.user.timezone || DEFAULT_TZ);
  const date = (body.date as string) || today;
  const onlyToday = date === today;

  let wakeTime = body.wakeTime ? String(body.wakeTime) : null;
  let bedtime = body.bedtime ? String(body.bedtime) : null;
  const notes = body.notes ? String(body.notes) : null;

  const sleepGoal = session.user.sleepGoal || "23:00";
  const tz = session.user.timezone || DEFAULT_TZ;
  const tzNow = nowMins(new Date(), tz);
  const clientNow =
    typeof body.nowMins === "number" &&
    Number.isFinite(body.nowMins) &&
    body.nowMins >= 0 &&
    body.nowMins < 24 * 60
      ? Math.round(body.nowMins)
      : null;
  const now = clientNow ?? tzNow;

  const [existing, plan] = await Promise.all([
    prisma.habitLog.findUnique({
      where: { userId_date: { userId: session.user.id, date } },
    }),
    prisma.dayPlan.findUnique({
      where: { userId_date: { userId: session.user.id, date } },
      select: { wakeGoal: true },
    }),
  ]);
  const wakeGoal = effectiveWakeGoal(plan?.wakeGoal, session.user.wakeGoal);
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
    if (!isInWindow(now, win.start, win.end)) {
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
    } else if (!isInWindow(now, win.start, win.end)) {
      wakeTime = null;
      rejected.push({
        key: "wakeTime",
        reason: `Wake window is ${win.start}–${win.end}.`,
      });
    } else if (!isHonestClockTime(wakeTime, now, 20, tz)) {
      wakeTime = null;
      rejected.push({
        key: "wakeTime",
        reason: "Use “I woke up” (logs current time). No backdating.",
      });
    } else {
      wakeAccepted = true;
      // On-time vs today's planned wake. The Wake habit still counts
      // from logging in the window (isHabitComplete uses wakeTime).
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
      const leftover = isLeftoverOvernightSleep(existing.bedtime, win, now);
      if (
        leftover &&
        isInWindow(now, win.start, win.end) &&
        isHonestClockTime(bedtime, now, 20, tz)
      ) {
        bedAccepted = true;
        checks.sleepEarly = true;
      } else {
        bedtime = existing.bedtime;
      }
    } else if (!isInWindow(now, win.start, win.end)) {
      bedtime = null;
      rejected.push({
        key: "bedtime",
        reason: `Sleep window is ${win.start}–${win.end}.`,
      });
    } else if (!isHonestClockTime(bedtime, now, 20, tz)) {
      bedtime = null;
      rejected.push({
        key: "bedtime",
        reason: "Use “Going to sleep” (logs current time). No backdating.",
      });
    } else {
      bedAccepted = true;
      checks.sleepEarly = true;
    }
  } else if (existing?.bedtime) {
    bedtime = existing.bedtime;
  }

  // Wake already set: keep on-time flag in sync. Do not rewrite sleepEarly
  // from a leftover bedtime — that auto-ticks Sleep early in the morning.
  if (wakeTime && !wakeAccepted) {
    checks.wakeEarly = isBeforeOrAt(wakeTime, wakeGoal);
  }

  const legacy = legacyFieldsFromChecks(checks);

  const hadWake = Boolean(existing?.wakeTime);
  const firstWakeToday = Boolean(wakeTime) && !hadWake && wakeAccepted;
  const hadBed = Boolean(existing?.bedtime);
  const firstBedToday = Boolean(bedtime) && !hadBed;
  const wakeEarlyNow = Boolean(checks.wakeEarly);
  const wakeEarlyNew =
    wakeEarlyNow && !prevChecks.wakeEarly && (wakeAccepted || firstWakeToday);

  const snapshot = { checks, wakeTime, bedtime };
  const prevSnapshot = {
    checks: prevChecks,
    wakeTime: existing?.wakeTime || null,
    bedtime: existing?.bedtime || null,
  };
  const sleepHabitDef =
    habits.find((h) => h.key === "sleepEarly") || {
      key: "sleepEarly",
      label: "Sleep",
      windowStart: null as string | null,
      windowEnd: null as string | null,
    };
  const sleepWinNow = resolveHabitWindow(sleepHabitDef, wakeGoal, sleepGoal);
  const completeOpts = {
    now,
    sleepWindow: { start: sleepWinNow.start, end: sleepWinNow.end },
  };
  const newlyDone = habitKeys.filter(
    (k) =>
      isHabitComplete(snapshot, k, completeOpts) &&
      !isHabitComplete(prevSnapshot, k, completeOpts)
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
    isHabitComplete(snapshot, focusKey, completeOpts) &&
    !isHabitComplete(prevSnapshot, focusKey, completeOpts) &&
    newlyDone.includes(focusKey);
  const perfectNow = isPerfectDay(snapshot, habitKeys, completeOpts);
  const perfectPrev = isPerfectDay(prevSnapshot, habitKeys, completeOpts);
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
  const habitsDoneNow = habitKeys.filter((k) =>
    isHabitComplete(snapshot, k, completeOpts)
  ).length;
  const loopComplete =
    firstBedToday &&
    Boolean(wakeTime) &&
    habitsDoneNow >= Math.max(1, Math.ceil(habitKeys.length * 0.5));
  if (
    firstWakeToday ||
    wakeEarlyNew ||
    awardHabits.length > 0 ||
    perfectNew ||
    firstBedToday
  ) {
    const award = awardCheckInXp({
      wakeLogged: firstWakeToday,
      wakeOnTime: Boolean(wakeEarlyNew || (firstWakeToday && wakeEarlyNow)),
      wakeStreak: earlyStreak.current,
      habitsNewlyDone: awardHabits.filter((k) => k !== "wakeEarly").length,
      focusDone: focusDoneNew && focusKey !== "wakeEarly",
      allDone: perfectNew,
      nightClosed: firstBedToday,
      loopComplete,
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
          loopComplete
            ? "Daily loop complete"
            : firstBedToday
              ? "Night closed"
              : wakeEarlyNew || (firstWakeToday && wakeEarlyNow)
            ? "On-time wake"
            : perfectNew
              ? "Morning complete"
              : newlyDone.length
                ? "Habit logged"
                : "Check-in saved",
        subtitle: loopComplete
          ? "+40 loop bonus. Same thing tomorrow."
          : firstBedToday
            ? "Streak lives through the night."
            : wakeEarlyNow
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

  const enriched = enrichHabitsWithWindows(
    habits,
    wakeGoal,
    sleepGoal,
    new Date(),
    tz
  );

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
