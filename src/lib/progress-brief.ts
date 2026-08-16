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

export type ReportRange = "today" | "week" | "month" | "year";

export type ProgressLeak = {
  where: string;
  why: string;
  fix: string;
};

export type ProgressReport = {
  tone: BriefTone;
  kicker: string;
  headline: string;
  happened: string[];
  leaked: ProgressLeak[];
  improved: string | null;
  next: string;
};

function rangeLabel(range: ReportRange) {
  if (range === "today") return "today";
  if (range === "week") return "this week";
  if (range === "month") return "this month";
  return "this year";
}

function prevLabel(range: ReportRange) {
  if (range === "today") return "yesterday";
  if (range === "week") return "last week";
  if (range === "month") return "last month";
  return "last year";
}

function enoughDays(range: ReportRange, loggedDays: number) {
  if (range === "today") return loggedDays >= 1;
  if (range === "week") return loggedDays >= 2;
  if (range === "month") return loggedDays >= 5;
  return loggedDays >= 8;
}

export function buildProgressReport(opts: {
  range: ReportRange;
  habitPct: number;
  taskPct: number;
  fullHabitDays: number;
  allTaskDays: number;
  loggedDays: number;
  windowDays: number;
  wakeOnTimeDays: number;
  wakeLoggedDays: number;
  nightDays: number;
  sleepAvg: number | null;
  weakestWeekday: string | null;
  strongestWeekday: string | null;
  weakestHabit: string | null;
  studyMinutes: number | null;
  studyLabel: string | null;
  prevHabitPct: number | null;
  prevTaskPct: number | null;
  leftoverHigh: string[];
}): ProgressReport {
  const {
    range,
    habitPct,
    taskPct,
    fullHabitDays,
    allTaskDays,
    loggedDays,
    windowDays,
    wakeOnTimeDays,
    wakeLoggedDays,
    nightDays,
    sleepAvg,
    weakestWeekday,
    strongestWeekday,
    weakestHabit,
    studyMinutes,
    studyLabel,
    prevHabitPct,
    prevTaskPct,
    leftoverHigh,
  } = opts;

  const window = rangeLabel(range);
  const leaked: ProgressLeak[] = [];
  const happened: string[] = [];

  if (wakeLoggedDays > 0) {
    happened.push(
      range === "today"
        ? wakeOnTimeDays
          ? "Woke on time."
          : "Woke, but after the goal."
        : `Woke on time ${wakeOnTimeDays} of ${wakeLoggedDays} logged mornings.`
    );
  }
  if (loggedDays > 0) {
    happened.push(
      range === "today"
        ? `Habits ${habitPct}%.`
        : `Habits ${habitPct}% across ${loggedDays} logged day${loggedDays === 1 ? "" : "s"}. ${fullHabitDays} full morning${fullHabitDays === 1 ? "" : "s"}.`
    );
  }
  if (allTaskDays > 0 || taskPct > 0) {
    happened.push(
      range === "today"
        ? `Tasks ${taskPct}%.`
        : `Tasks ${taskPct}%. Cleared the list on ${allTaskDays} day${allTaskDays === 1 ? "" : "s"}.`
    );
  } else if (studyMinutes != null && studyMinutes > 0 && studyLabel) {
    happened.push(`Study ${studyLabel}${range === "month" || range === "year" ? " (last 30 days)" : ""}.`);
  } else if (nightDays > 0) {
    happened.push(`Closed ${nightDays} night${nightDays === 1 ? "" : "s"}.`);
  }

  if (happened.length < 2 && sleepAvg != null) {
    happened.push(`Sleep averaging ${sleepAvg}h.`);
  }
  if (happened.length > 3) happened.length = 3;
  if (happened.length === 0) {
    happened.push(`No check-in ${window} yet.`);
    happened.push("Charts stay empty until a wake or a task lands.");
  }

  for (const text of leftoverHigh.slice(0, 2)) {
    leaked.push({
      where: "High task still open",
      why: text,
      fix: "Do this one before adding anything else.",
    });
  }
  if (weakestWeekday && range !== "today") {
    leaked.push({
      where: prettyWeekday(weakestWeekday),
      why: "That’s the weekday that usually drops.",
      fix: `Protect ${prettyWeekday(weakestWeekday).toLowerCase()} — same wake, one habit, short list.`,
    });
  }
  if (weakestHabit) {
    leaked.push({
      where: weakestHabit,
      why: "Lowest hit rate on days you actually checked in.",
      fix: "Fix this habit before adding a new one.",
    });
  }
  if (sleepAvg != null && sleepAvg < 6.5) {
    leaked.push({
      where: "Sleep",
      why: `Averaging ${sleepAvg}h. Under 7h, mornings and study get cheaper.`,
      fix: "Bed on time tonight. Don’t add habits.",
    });
  }
  if (taskPct < 40 && loggedDays > 0 && leftoverHigh.length === 0) {
    leaked.push({
      where: "Tasks",
      why: `${taskPct}% ${window}. Lists are being set and left.`,
      fix: "Three items. Finish them. Don’t write a manifesto.",
    });
  }
  if (leaked.length > 3) leaked.length = 3;

  let improved: string | null = null;
  if (prevHabitPct != null && loggedDays > 0) {
    const delta = habitPct - prevHabitPct;
    if (Math.abs(delta) >= 4) {
      improved =
        delta > 0
          ? `Habits ${delta} pts better than ${prevLabel(range)}.`
          : `Habits ${Math.abs(delta)} pts worse than ${prevLabel(range)}.`;
    } else if (prevTaskPct != null) {
      const td = taskPct - prevTaskPct;
      if (Math.abs(td) >= 4) {
        improved =
          td > 0
            ? `Tasks ${td} pts better than ${prevLabel(range)}.`
            : `Tasks ${Math.abs(td)} pts worse than ${prevLabel(range)}.`;
      } else {
        improved = `About even with ${prevLabel(range)} — habits ${habitPct}% vs ${prevHabitPct}%.`;
      }
    }
  }

  if (!enoughDays(range, loggedDays) && (studyMinutes == null || studyMinutes <= 0)) {
    return {
      tone: "start",
      kicker: range === "today" ? "Today" : "Thin sample",
      headline:
        range === "today"
          ? "Today isn’t closed yet — not enough to score."
          : `Not enough days ${window} to call a pattern.`,
      happened,
      leaked,
      improved,
      next: "Open Today, wake in your window, and close the night.",
    };
  }

  const wakeShare =
    wakeLoggedDays > 0 ? wakeOnTimeDays / wakeLoggedDays : 0;
  const holding =
    habitPct >= 70 &&
    (range === "today" ? fullHabitDays >= 1 : fullHabitDays >= Math.max(2, Math.floor(windowDays * 0.4)));

  if (holding && wakeShare >= 0.5) {
    return {
      tone: "good",
      kicker: "Holding",
      headline:
        range === "today"
          ? "Morning closed. Don’t spend the afternoon inventing a new system."
          : `You finished the morning on ${fullHabitDays} of ${windowDays} days ${window}.`,
      happened,
      leaked,
      improved,
      next:
        strongestWeekday && weakestWeekday && strongestWeekday !== weakestWeekday
          ? `${prettyWeekday(strongestWeekday)} already work. Copy that on ${prettyWeekday(weakestWeekday).toLowerCase()}.`
          : leftoverHigh[0]
            ? `Clear “${leftoverHigh[0]}” before the day ends.`
            : "Keep the same wake window. Don’t add more habits.",
    };
  }

  if (habitPct < 40 || (range !== "today" && fullHabitDays <= 1)) {
    return {
      tone: "slip",
      kicker: "Thin",
      headline:
        range === "today"
          ? `Habits at ${habitPct}%. The morning is still open.`
          : `Only ${fullHabitDays} full morning${fullHabitDays === 1 ? "" : "s"} ${window}.`,
      happened,
      leaked,
      improved,
      next: leftoverHigh[0]
        ? `Do “${leftoverHigh[0]}”. Then bed on time.`
        : weakestWeekday
          ? `${prettyWeekday(weakestWeekday)} are the leak. Tonight: bed. Tomorrow: wake + one habit.`
          : "Tonight: bed on time. Tomorrow: wake + one habit. That’s the repair.",
    };
  }

  return {
    tone: "slip",
    kicker: "Uneven",
    headline:
      range === "today"
        ? `Partial day — habits ${habitPct}%, tasks ${taskPct}%.`
        : `Mornings are partial — ${habitPct}% habits, ${fullHabitDays} complete days.`,
    happened,
    leaked,
    improved,
    next:
      leftoverHigh[0]
        ? `Finish “${leftoverHigh[0]}” before you add another task.`
        : weakestWeekday && strongestWeekday
          ? `${prettyWeekday(strongestWeekday)} work. Copy that on ${prettyWeekday(weakestWeekday).toLowerCase()}.`
          : "Pick one open habit after wake. Don’t wait for a perfect morning.",
  };
}
