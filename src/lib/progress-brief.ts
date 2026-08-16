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
  if (range === "week") return "the last 7 days";
  if (range === "month") return "the last 30 days";
  return "the last year";
}

function prevLabel(range: ReportRange) {
  if (range === "today") return "yesterday";
  if (range === "week") return "the 7 days before that";
  if (range === "month") return "the 30 days before that";
  return "the year before";
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
          ? "Wake: on time, inside your goal."
          : "Wake: logged, but after your goal time."
        : `Wake: on time ${wakeOnTimeDays} of ${wakeLoggedDays} mornings you logged.`
    );
  }
  if (loggedDays > 0) {
    happened.push(
      range === "today"
        ? `Habits: ${habitPct}% done today.`
        : `Habits: ${habitPct}% done. Full mornings (every habit closed): ${fullHabitDays} of ${windowDays} days.`
    );
  }
  if (allTaskDays > 0 || taskPct > 0) {
    happened.push(
      range === "today"
        ? `Tasks: ${taskPct}% of today’s list is done.`
        : `Tasks: ${taskPct}% done. You cleared the whole list on ${allTaskDays} day${allTaskDays === 1 ? "" : "s"}.`
    );
  }
  if (studyMinutes != null && studyMinutes > 0 && studyLabel) {
    happened.push(
      range === "month" || range === "year"
        ? `Study: ${studyLabel} in the last 30 days (Discord study rooms).`
        : `Study: ${studyLabel} ${window}.`
    );
  }
  if (sleepAvg != null) {
    happened.push(
      sleepAvg < 6.5
        ? `Sleep: ${sleepAvg}h a night — under 7h, mornings get harder.`
        : `Sleep: ${sleepAvg}h a night on average.`
    );
  } else if (nightDays > 0) {
    happened.push(
      `Night: you closed ${nightDays} night${nightDays === 1 ? "" : "s"} ${window}.`
    );
  }
  if (happened.length === 0) {
    happened.push(`Nothing logged ${window} yet.`);
    happened.push("Log a wake or finish a task on Today — then this page can score you.");
  }

  for (const text of leftoverHigh.slice(0, 1)) {
    leaked.push({
      where: text,
      why: "This high-priority task is still open.",
      fix: "Finish it before you add anything else.",
    });
  }
  if (weakestWeekday && range !== "today") {
    leaked.push({
      where: prettyWeekday(weakestWeekday),
      why: "That’s the weekday your habits drop the most.",
      fix: `Same wake time, one habit, a short list — treat ${prettyWeekday(weakestWeekday).toLowerCase()} like a work day.`,
    });
  }
  if (weakestHabit) {
    leaked.push({
      where: weakestHabit,
      why: "This is the habit you skip most on days you check in.",
      fix: "Close this one after wake before you add a new habit.",
    });
  }
  if (sleepAvg != null && sleepAvg < 6.5) {
    leaked.push({
      where: "Sleep",
      why: `You’re averaging ${sleepAvg}h. Under 7 hours, wake and study both slip.`,
      fix: "Go to bed on time tonight. Don’t add more habits.",
    });
  }
  if (taskPct < 40 && loggedDays > 0 && leftoverHigh.length === 0) {
    leaked.push({
      where: "Tasks",
      why: `Only ${taskPct}% of listed work got done ${window}.`,
      fix: "Write three items. Finish those three. Stop adding.",
    });
  }
  if (leaked.length > 3) leaked.length = 3;

  let improved: string | null = null;
  if (prevHabitPct != null && loggedDays > 0) {
    const delta = habitPct - prevHabitPct;
    if (Math.abs(delta) >= 4) {
      improved =
        delta > 0
          ? `Habits are up ${delta} points vs ${prevLabel(range)} (${habitPct}% vs ${prevHabitPct}%).`
          : `Habits are down ${Math.abs(delta)} points vs ${prevLabel(range)} (${habitPct}% vs ${prevHabitPct}%).`;
    } else if (prevTaskPct != null) {
      const td = taskPct - prevTaskPct;
      if (Math.abs(td) >= 4) {
        improved =
          td > 0
            ? `Tasks are up ${td} points vs ${prevLabel(range)} (${taskPct}% vs ${prevTaskPct}%).`
            : `Tasks are down ${Math.abs(td)} points vs ${prevLabel(range)} (${taskPct}% vs ${prevTaskPct}%).`;
      } else {
        improved = `About the same as ${prevLabel(range)} — habits ${prevHabitPct}% then, ${habitPct}% now.`;
      }
    }
  }

  if (!enoughDays(range, loggedDays) && (studyMinutes == null || studyMinutes <= 0)) {
    return {
      tone: "start",
      kicker: "Not enough data",
      headline:
        range === "today"
          ? "Today isn’t finished yet — nothing here to score."
          : `Only ${loggedDays} day${loggedDays === 1 ? "" : "s"} logged ${window}. That’s too little to call a pattern.`,
      happened,
      leaked,
      improved,
      next: "Go to Today, log your wake, finish one habit, and close the night.",
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
      kicker: "On track",
      headline:
        range === "today"
          ? "Morning is closed. Keep the rest of the day simple."
          : `You finished every habit on ${fullHabitDays} of ${windowDays} days.`,
      happened,
      leaked,
      improved,
      next:
        strongestWeekday && weakestWeekday && strongestWeekday !== weakestWeekday
          ? `${prettyWeekday(strongestWeekday)} already work. Copy that same wake + first habit on ${prettyWeekday(weakestWeekday).toLowerCase()}.`
          : leftoverHigh[0]
            ? `Finish “${leftoverHigh[0]}” before the day ends.`
            : "Keep the same wake time. Don’t add more habits.",
    };
  }

  if (habitPct < 40 || (range !== "today" && fullHabitDays <= 1)) {
    return {
      tone: "slip",
      kicker: "Falling behind",
      headline:
        range === "today"
          ? `Only ${habitPct}% of habits are done. The morning is still open.`
          : `You only finished a full morning ${fullHabitDays} time${fullHabitDays === 1 ? "" : "s"} ${window}.`,
      happened,
      leaked,
      improved,
      next: leftoverHigh[0]
        ? `Do “${leftoverHigh[0]}”, then go to bed on time.`
        : weakestWeekday
          ? `${prettyWeekday(weakestWeekday)} are the weak day. Tonight: bed on time. Tomorrow: wake + one habit.`
          : "Tonight: bed on time. Tomorrow: wake + one habit. That’s the repair.",
    };
  }

  return {
    tone: "slip",
    kicker: "Inconsistent",
    headline:
      range === "today"
        ? `Partial day — habits ${habitPct}% done, tasks ${taskPct}% done.`
        : `You showed up, but didn’t finish — habits ${habitPct}%, only ${fullHabitDays} complete morning${fullHabitDays === 1 ? "" : "s"}.`,
    happened,
    leaked,
    improved,
    next:
      leftoverHigh[0]
        ? `Finish “${leftoverHigh[0]}” before you add another task.`
        : weakestWeekday && strongestWeekday
          ? `${prettyWeekday(strongestWeekday)} work. Use that same wake time on ${prettyWeekday(weakestWeekday).toLowerCase()}.`
          : "After you wake, close one open habit. Don’t wait for a perfect morning.",
  };
}
