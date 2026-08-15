export type BriefTone = "good" | "slip" | "start";

export type ProgressBrief = {
  tone: BriefTone;
  kicker: string;
  headline: string;
  body: string;
  next: string;
};

function prettyWeekday(name: string) {
  const map: Record<string, string> = {
    Sun: "Sundays",
    Mon: "Mondays",
    Tue: "Tuesdays",
    Wed: "Wednesdays",
    Thu: "Thursdays",
    Fri: "Fridays",
    Sat: "Saturdays",
  };
  return map[name] || name;
}

export function buildProgressBrief(opts: {
  habitPct7: number;
  taskPct7: number;
  fullHabitDays7: number;
  allTaskDays7: number;
  loggedDays7: number;
  sleepAvg: number | null;
  weakestWeekday: string | null;
  strongestWeekday: string | null;
  studyWeekMinutes: number | null;
  studyTodayMinutes: number | null;
}): ProgressBrief {
  const {
    habitPct7,
    taskPct7,
    fullHabitDays7,
    loggedDays7,
    sleepAvg,
    weakestWeekday,
    strongestWeekday,
    studyWeekMinutes,
    studyTodayMinutes,
  } = opts;

  if (loggedDays7 < 2 && (studyWeekMinutes == null || studyWeekMinutes <= 0)) {
    return {
      tone: "start",
      kicker: "First days",
      headline: "Not enough days to judge a pattern yet.",
      body: "Check in for a few mornings. These charts become useful once Dawn can compare weekdays, not one lucky day.",
      next: "Open Today, wake in your window, and close the night.",
    };
  }

  const sleepLine =
    sleepAvg != null
      ? sleepAvg < 6.5
        ? ` Sleep is averaging ${sleepAvg}h — under 7h, willpower for habits and study drops.`
        : sleepAvg >= 7.5
          ? ` Sleep is holding at ${sleepAvg}h. Keep that.`
          : ` Sleep is about ${sleepAvg}h. Nudge bedtime earlier if mornings feel heavy.`
      : "";

  const studyLine =
    studyTodayMinutes != null && studyTodayMinutes > 0
      ? ` You already studied today.`
      : studyWeekMinutes != null && studyWeekMinutes > 0
        ? ` Study this week is on the board — sit down today so it doesn’t all pile on one night.`
        : "";

  if (habitPct7 >= 70 && fullHabitDays7 >= 4) {
    return {
      tone: "good",
      kicker: "On track",
      headline: `You finished the morning on ${fullHabitDays7} of the last 7 days.`,
      body: `Habits are at ${habitPct7}% this week. Tasks ${taskPct7}%.${sleepLine}${studyLine}`,
      next:
        strongestWeekday && weakestWeekday && strongestWeekday !== weakestWeekday
          ? `${prettyWeekday(strongestWeekday)} are your strongest. Protect ${prettyWeekday(weakestWeekday).toLowerCase()} — that’s where the week usually breaks.`
          : "Keep the same wake window. Don’t add more habits.",
    };
  }

  if (habitPct7 < 40 || fullHabitDays7 <= 1) {
    return {
      tone: "slip",
      kicker: "Thin week",
      headline: `Only ${fullHabitDays7} full morning${fullHabitDays7 === 1 ? "" : "s"} in the last 7 days.`,
      body: `Habits sat at ${habitPct7}%. That’s a slip, not a personality.${sleepLine}${studyLine}`,
      next: weakestWeekday
        ? `${prettyWeekday(weakestWeekday)} are the leak. Tonight: bed on time, one habit tomorrow — not a restart fantasy.`
        : "Tonight: bed on time. Tomorrow: wake + one habit. That’s the repair.",
    };
  }

  return {
    tone: "slip",
    kicker: "Uneven",
    headline: `Mornings are partial — ${habitPct7}% habits, ${fullHabitDays7} complete days.`,
    body: `You’re showing up, but not closing the loop.${sleepLine}${studyLine}`,
    next:
      weakestWeekday && strongestWeekday
        ? `${prettyWeekday(strongestWeekday)} work. Copy that on ${prettyWeekday(weakestWeekday).toLowerCase()} — same wake, same first habit.`
        : "Pick one open habit after wake. Don’t wait for a perfect morning.",
  };
}
