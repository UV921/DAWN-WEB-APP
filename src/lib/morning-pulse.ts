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
  nextHabit?: string;
  tasksLeft?: number;
}): MorningPulse {
  const { week } = opts;
  const wakeRate = week.days ? week.wakeOnTime / week.days : 0;
  const nightRate = week.days ? week.nightsClosed / week.days : 0;
  const habitRate = week.habitSlots ? week.habitHits / week.habitSlots : 0;
  const morningPct =
    opts.habitsTotal > 0 ? opts.habitsDone / opts.habitsTotal : 0;
  const next = opts.nextHabit;
  const left = opts.tasksLeft ?? Math.max(0, opts.tasksTotal - opts.tasksDone);

  if (week.days < 2 && !opts.todayWake) {
    return {
      tone: "start",
      headline: "The loop starts with one tap.",
      body: "Wake in your window. Check the habit that’s open. Dump tomorrow’s work tonight. That’s Dawn — not a mood.",
      nextMove: "Hold I’m awake. Then tap the first open habit.",
    };
  }

  if (!opts.todayWake) {
    return {
      tone: "start",
      headline: "Wake isn’t logged.",
      body: "The loop starts in your wake window. Habits still unlock on their own clocks — tap whichever is open.",
      nextMove: next
        ? `Hold I’m awake if you can. Or tap ${next} now.`
        : "Hold I’m awake while the wake window is open.",
    };
  }

  if (wakeRate < 0.35 && week.days >= 4) {
    return {
      tone: "danger",
      headline: `${week.wakeOnTime} of ${week.days} wakes on time. That’s not a streak.`,
      body: "The morning isn’t failing in the morning. It’s failing the night before. Late bed → snooze → skipped habits.",
      nextMove: "Tonight: close Dawn in the sleep window before you scroll.",
    };
  }

  if (nightRate < 0.4 && week.days >= 4) {
    return {
      tone: "slip",
      headline: `Only ${week.nightsClosed} nights closed in ${week.days} days.`,
      body: "You start mornings. You don’t finish days. The streak dies in the evening, not at the alarm.",
      nextMove: "Tonight: 3 tasks for tomorrow, then Save & going to sleep.",
    };
  }

  if (habitRate < 0.3 && week.days >= 4) {
    return {
      tone: "slip",
      headline: `You hit ${week.habitHits}/${week.habitSlots} habit checks this week.`,
      body: "A long list you ignore is worse than two you finish. Windows exist so you can’t fake it at midnight.",
      nextMove: next
        ? `Do ${next} now — it’s the one that’s open.`
        : "Do the next open habit. Hide the rest until this one is automatic.",
    };
  }

  if (opts.todayWake && morningPct < 0.5 && opts.habitsTotal > 1) {
    return {
      tone: "slip",
      headline: `Up. Morning is ${opts.habitsDone}/${opts.habitsTotal}.`,
      body: "Waking up isn’t the habit. The next open window is. Half-done mornings don’t compound.",
      nextMove: next
        ? `Tap ${next}. Then ${left ? `clear ${left} task${left === 1 ? "" : "s"}` : "open Tasks"}.`
        : "Tap the next open habit. Then dump leftover work into Tasks.",
    };
  }

  if (left > 0 && opts.tasksTotal > 0 && opts.tasksDone / opts.tasksTotal < 0.4) {
    return {
      tone: "slip",
      headline: `${left} task${left === 1 ? "" : "s"} still open. That’s tomorrow’s snooze.`,
      body: "Unfinished work at night becomes delay in the morning. Finish, cut, or it follows you to the alarm.",
      nextMove: "Open Tasks. Finish or delete. Then close the night.",
    };
  }

  if (opts.streak >= 3 && !opts.nightClosed) {
    return {
      tone: "good",
      headline: `${opts.streak}-day wake streak. One late night ends it.`,
      body: "You’re earning this. Don’t donate it to the phone. Close the day and the streak survives.",
      nextMove: "Set tomorrow in the sleep window, then Save & going to sleep.",
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
      body: "This is the version that compounds. Keep the night boring so the morning stays sharp.",
      nextMove: opts.nightClosed
        ? next
          ? `Knock out ${next}, then tasks.`
          : "Habits, then tasks. The loop is yours."
        : "Protect the streak: close tonight in Dawn.",
    };
  }

  return {
    tone: "start",
    headline: "Wake → habits → tasks → night.",
    body: `This week: ${week.wakeOnTime} on-time wakes, ${week.nightsClosed} nights closed, ${week.habitHits}/${week.habitSlots || 0} habits. Both ends of the day have to get a tap.`,
    nextMove: next
      ? `Next tap: ${next}. XP pays the loop, not wishing.`
      : "Finish what’s open. Close the night. Same thing tomorrow.",
  };
}
