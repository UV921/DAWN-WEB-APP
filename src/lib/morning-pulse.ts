import type { HabitLogLike } from "@/lib/habits";
import { isHabitDone } from "@/lib/habits";

export type PulseTone = "start" | "good" | "slip" | "danger";

export type WeekPulse = {
  days: number;
  wakeOnTime: number;
  wakeLogged: number;
  nightsClosed: number;
  habitHits: number;
  habitSlots: number;
};

export type MorningPulse = {
  tone: PulseTone;
  headline: string;
  body: string;
  nextMove: string;
};

export function summarizeWeek(
  logs: HabitLogLike[],
  habitKeys: string[],
  days = 7
): WeekPulse {
  const slice = logs.slice(-days);
  const keys = habitKeys.filter((k) => k !== "wakeEarly" && k !== "sleepEarly");
  let habitHits = 0;
  let habitSlots = 0;
  for (const l of slice) {
    for (const k of keys) {
      habitSlots += 1;
      if (isHabitDone(l, k)) habitHits += 1;
    }
  }
  return {
    days: slice.length,
    wakeOnTime: slice.filter((l) => isHabitDone(l, "wakeEarly")).length,
    wakeLogged: slice.filter((l) => Boolean(l.wakeTime)).length,
    nightsClosed: slice.filter((l) => Boolean(l.bedtime)).length,
    habitHits,
    habitSlots,
  };
}

/** Honest coach copy from real numbers — not pep talk. */
export function buildMorningPulse(opts: {
  week: WeekPulse;
  todayWake: boolean;
  habitsDone: number;
  habitsTotal: number;
  tasksDone: number;
  tasksTotal: number;
  nightClosed: boolean;
  streak: number;
  runDay?: number;
  runTotal?: number;
}): MorningPulse {
  const { week } = opts;
  const wakeRate = week.days ? week.wakeOnTime / week.days : 0;
  const nightRate = week.days ? week.nightsClosed / week.days : 0;
  const habitRate = week.habitSlots ? week.habitHits / week.habitSlots : 0;
  const morningPct =
    opts.habitsTotal > 0 ? opts.habitsDone / opts.habitsTotal : 0;

  if (week.days < 2 && !opts.todayWake) {
    return {
      tone: "start",
      headline: "Day one is a tap, not a personality.",
      body: "No history yet. Wake on time, check one habit, dump tomorrow’s tasks tonight. That’s the loop.",
      nextMove: "Log wake, then set tonight’s tasks so tomorrow isn’t guesswork.",
    };
  }

  if (wakeRate < 0.35 && week.days >= 4) {
    return {
      tone: "danger",
      headline: `${week.wakeOnTime} of ${week.days} wakes on time. That’s not a streak.`,
      body: "The morning isn’t failing in the morning. It’s failing the night before. Late bed → snooze → skipped habits.",
      nextMove: "Protect bedtime tonight. Close the day in Dawn before you scroll.",
    };
  }

  if (nightRate < 0.4 && week.days >= 4) {
    return {
      tone: "slip",
      headline: `Only ${week.nightsClosed} nights closed in ${week.days} days.`,
      body: "You start mornings. You don’t finish days. The streak dies in the evening, not at the alarm.",
      nextMove: "Tonight: set 3 tasks for tomorrow, then log sleep. That’s the reward loop.",
    };
  }

  if (habitRate < 0.3 && week.days >= 4) {
    return {
      tone: "slip",
      headline: "Habits are listed. They’re not happening.",
      body: `You hit ${week.habitHits} of ${week.habitSlots} habit checks this week. A long list you ignore is worse than two you finish.`,
      nextMove: "Do the next open habit now. Hide the rest until this one is automatic.",
    };
  }

  if (opts.streak >= 3 && !opts.nightClosed) {
    return {
      tone: "good",
      headline: `${opts.streak}-day wake streak. One late night ends it.`,
      body: "You’re earning this. Don’t donate it to the phone at 11:40. Close the day and the streak survives.",
      nextMove: "Set tomorrow’s tasks now so you don’t stall in the morning.",
    };
  }

  if (opts.todayWake && morningPct < 0.5 && opts.habitsTotal > 1) {
    return {
      tone: "slip",
      headline: `Up — but the morning is ${opts.habitsDone}/${opts.habitsTotal}.`,
      body: "Waking up isn’t the habit. What you do in the next hour is. Half-done mornings don’t compound.",
      nextMove: "Tap the next open habit. Then dump leftover work into Tasks so it isn’t floating.",
    };
  }

  if (opts.tasksTotal > 0 && opts.tasksDone < opts.tasksTotal && opts.tasksDone / opts.tasksTotal < 0.4) {
    return {
      tone: "slip",
      headline: `${opts.tasksTotal - opts.tasksDone} tasks still open. That’s tomorrow’s snooze.`,
      body: "Unfinished work at night becomes delay in the morning. Clear a few or cut the list. Don’t carry fog.",
      nextMove: "Open Tasks. Finish or delete. Then close the night.",
    };
  }

  if (wakeRate >= 0.7 && opts.streak >= 2) {
    const run =
      opts.runDay && opts.runTotal
        ? ` Run ${opts.runDay}/${opts.runTotal}.`
        : "";
    return {
      tone: "good",
      headline: `${opts.streak} early. ${week.wakeOnTime}/${week.days} on time this week.${run}`,
      body: "This is the version of you that compounds. Keep the night boring so the morning stays sharp.",
      nextMove: opts.nightClosed
        ? "Morning’s yours. Knock out habits, then tasks."
        : "Protect the streak: close tonight in Dawn.",
    };
  }

  return {
    tone: "start",
    headline: "Same loop, every day. That’s the product.",
    body: `This week: ${week.wakeOnTime} on-time wakes, ${week.nightsClosed} nights closed. The app only works if both ends of the day get a tap.`,
    nextMove: "Wake → habits → tasks → close night. XP pays that loop, not wishing.",
  };
}
