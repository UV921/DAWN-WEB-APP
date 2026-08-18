import {
  type HabitLogLike,
  formatLocalDate,
  isBeforeOrAt,
  isSleepEarly,
  timeToMinutes,
} from "@/lib/habits";

export type SleepGrade =
  | "excellent"
  | "good"
  | "ok"
  | "late"
  | "very_late"
  | "short"
  | "missing";

export type SleepDayReport = {
  date: string;
  bedtime: string | null;
  wakeTime: string | null;
  sleepGoal: string;
  wakeGoal: string;
  grade: SleepGrade;
  label: string;
  score: number; // 0–100 night quality score
  minutesPastGoal: number | null;
  minutesPastWakeGoal: number | null;
  durationHours: number | null;
  targetHours: number;
  sleepDebtHours: number | null;
  summary: string;
  tips: string[];
  actions: string[];
  highlights: string[];
};

export type SleepWeekReport = {
  daysLogged: number;
  avgBedtime: string | null;
  avgWake: string | null;
  onTimeRate: number;
  wakeOnTimeRate: number;
  avgDurationHours: number | null;
  consistencyScore: number; // 0–100, lower variance = higher
  sleepDebtHours: number;
  socialJetlagMin: number | null;
  tips: string[];
};

export type CoachPlan = {
  headline: string;
  why: string;
  tonightBed: string;
  windDown: string;
  morningWake: string;
  steps: string[];
  focus: "consistency" | "earlier_bed" | "protect_wake" | "recover" | "maintain";
};

/** Adult floor — below this, mornings and willpower usually crack. */
export const MIN_SLEEP_HOURS = 7;
/** Healthy target most people should plan for. */
export const TARGET_SLEEP_HOURS = 8;
const TARGET_HOURS = TARGET_SLEEP_HOURS;

export function minutesToHHMM(total: number): string {
  let m = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/**
 * Clock time on an overnight axis: evening stays as-is, morning
 * (before noon) is shifted +24h so 23:00 → 06:00 is a continuous span.
 */
export function overnightMinutes(hhmm: string): number {
  const m = timeToMinutes(hhmm);
  return m < 12 * 60 ? m + 24 * 60 : m;
}

export function overnightSpan(
  start: string,
  end: string
): { startMin: number; endMin: number } {
  const startMin = overnightMinutes(start);
  let endMin = overnightMinutes(end);
  if (endMin <= startMin) endMin += 24 * 60;
  return { startMin, endMin };
}

/** Nice hour-aligned window that fits every listed clock time. */
export function sleepAxisRange(
  times: string[],
  paddingMin = 75
): { start: number; end: number } {
  if (times.length === 0) {
    return { start: 21 * 60, end: 30 * 60 };
  }
  const vals = times.map(overnightMinutes);
  let lo = Math.min(...vals) - paddingMin;
  let hi = Math.max(...vals) + paddingMin;
  lo = Math.floor(lo / 60) * 60;
  hi = Math.ceil(hi / 60) * 60;
  if (hi - lo < 8 * 60) {
    const extra = Math.ceil((8 * 60 - (hi - lo)) / 2 / 60) * 60;
    lo -= extra;
    hi += extra;
  }
  return { start: lo, end: hi };
}

export function sleepAxisTicks(start: number, end: number): number[] {
  const hours = (end - start) / 60;
  const step = hours > 12 ? 180 : hours > 8 ? 120 : 60;
  const first = Math.ceil(start / step) * step;
  const ticks: number[] = [];
  for (let t = first; t <= end; t += step) ticks.push(t);
  return ticks.length > 0 ? ticks : [start, end];
}

/** Ideal bedtime so you get `hours` before wakeGoal. */
export function idealBedtimeForWake(
  wakeGoal: string,
  hours = TARGET_HOURS
): string {
  return minutesToHHMM(timeToMinutes(wakeGoal) - hours * 60);
}

export function windDownTime(bedtime: string, minutesBefore = 60): string {
  return minutesToHHMM(timeToMinutes(bedtime) - minutesBefore);
}

export function sleepDurationHours(bedtime: string, wakeTime: string): number {
  const bed = timeToMinutes(bedtime);
  const wake = timeToMinutes(wakeTime);
  let mins: number;
  if (bed > wake || bed >= 12 * 60) {
    mins = 24 * 60 - bed + wake;
  } else {
    mins = wake - bed;
  }
  mins = Math.max(0, Math.min(mins, 16 * 60));
  return Math.round((mins / 60) * 10) / 10;
}

export function minutesPastSleepGoal(
  bedtime: string,
  sleepGoal: string
): number {
  const bed = timeToMinutes(bedtime);
  const goal = timeToMinutes(sleepGoal);
  if (goal >= 12 * 60) {
    if (bed >= 12 * 60) return bed - goal;
    return 24 * 60 - goal + bed;
  }
  return bed - goal;
}

export function minutesPastWakeGoal(
  wakeTime: string,
  wakeGoal: string
): number {
  return timeToMinutes(wakeTime) - timeToMinutes(wakeGoal);
}

function averageTime(times: string[]): string | null {
  if (times.length === 0) return null;
  const mins = times.map(overnightMinutes);
  const avg =
    Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) % (24 * 60);
  return minutesToHHMM(avg);
}

function stdDevMinutes(times: string[]): number | null {
  if (times.length < 2) return null;
  const mins = times.map(overnightMinutes);
  const mean = mins.reduce((a, b) => a + b, 0) / mins.length;
  const variance =
    mins.reduce((a, b) => a + (b - mean) ** 2, 0) / mins.length;
  return Math.round(Math.sqrt(variance));
}

function nightScore(opts: {
  bedtime: string | null;
  wakeTime: string | null;
  sleepGoal: string;
  wakeGoal: string;
  noPhone: boolean;
  durationHours: number | null;
}): { score: number; grade: SleepGrade; label: string } {
  const { bedtime, wakeTime, sleepGoal, wakeGoal, noPhone, durationHours } =
    opts;
  if (!bedtime && !wakeTime) {
    return { score: 0, grade: "missing", label: "Not logged" };
  }

  let score = 40;

  if (bedtime) {
    const past = minutesPastSleepGoal(bedtime, sleepGoal);
    if (past <= -20) score += 25;
    else if (past <= 0) score += 20;
    else if (past <= 30) score += 10;
    else if (past <= 60) score += 0;
    else score -= 15;
  }

  if (wakeTime) {
    const pastW = minutesPastWakeGoal(wakeTime, wakeGoal);
    if (pastW <= 0) score += 25;
    else if (pastW <= 20) score += 12;
    else if (pastW <= 45) score += 0;
    else score -= 12;
  }

  if (durationHours != null) {
    if (durationHours >= 7.5 && durationHours <= 9) score += 15;
    else if (durationHours >= 7 && durationHours < 7.5) score += 8;
    else if (durationHours >= 6.5) score += 2;
    else score -= 15;
  }

  if (noPhone) score += 8;
  else if (bedtime) score -= 5;

  score = Math.max(0, Math.min(100, score));

  if (durationHours != null && durationHours < 6.5 && score >= 50) {
    return { score, grade: "short", label: "Too little sleep" };
  }
  if (score >= 85) return { score, grade: "excellent", label: "Strong night" };
  if (score >= 70) return { score, grade: "good", label: "Solid" };
  if (score >= 55) return { score, grade: "ok", label: "Okay" };
  if (score >= 40) return { score, grade: "late", label: "Needs work" };
  return { score, grade: "very_late", label: "Rough night" };
}

export function buildDaySleepReport(
  log: HabitLogLike | null | undefined,
  date: string,
  sleepGoal: string,
  wakeGoal: string,
  recentLogs: HabitLogLike[] = []
): SleepDayReport {
  const bedtime = log?.bedtime ?? null;
  const wakeTime = log?.wakeTime ?? null;
  const durationHours =
    bedtime && wakeTime ? sleepDurationHours(bedtime, wakeTime) : null;
  const minutesPast =
    bedtime != null ? minutesPastSleepGoal(bedtime, sleepGoal) : null;
  const minutesPastWake =
    wakeTime != null ? minutesPastWakeGoal(wakeTime, wakeGoal) : null;

  const { score, grade, label } = nightScore({
    bedtime,
    wakeTime,
    sleepGoal,
    wakeGoal,
    noPhone: Boolean(
      log?.checks?.noPhone ?? log?.noPhone ?? false
    ),
    durationHours,
  });

  const sleepDebtHours =
    durationHours != null
      ? Math.round(Math.max(0, TARGET_HOURS - durationHours) * 10) / 10
      : null;

  const ideal = idealBedtimeForWake(wakeGoal, TARGET_HOURS);
  const tips: string[] = [];
  const actions: string[] = [];

  if (grade === "missing") {
    tips.push(
      `To wake at ${wakeGoal} feeling human, aim for ~${TARGET_HOURS}h — that means lights out near ${ideal}.`
    );
    tips.push(
      "Science-backed: a fixed wake time trains your body clock more than a perfect bedtime."
    );
    actions.push(`Tonight: start wind-down at ${windDownTime(ideal)}.`);
    actions.push(`Be in bed by ${ideal}. Alarm at ${wakeGoal} — no snooze.`);
  } else {
    if (wakeTime && minutesPastWake != null) {
      if (minutesPastWake <= 0) {
        tips.push(
          `You hit wake goal (${wakeTime}). Protect this — same wake time tomorrow, even if bedtime slips a bit.`
        );
      } else {
        tips.push(
          `Woke ${minutesPastWake} min after ${wakeGoal}. Snooze and late wake push tomorrow’s bedtime later (circadian drift).`
        );
        actions.push(
          `Tomorrow: alarm at ${wakeGoal}, get sunlight/outdoor light within 30 min.`
        );
      }
    }

    if (bedtime && minutesPast != null) {
      if (minutesPast > 30) {
        tips.push(
          `Bedtime ${bedtime} was ~${minutesPast} min past ${sleepGoal}. Late nights make early mornings feel impossible.`
        );
        actions.push(
          `Tonight: sleep ${Math.min(30, minutesPast)} min earlier than last night (small steps stick).`
        );
      } else if (minutesPast <= 0) {
        tips.push(`Bedtime on target (${bedtime}). Keep the same wind-down cue.`);
      }
    }

    if (durationHours != null) {
      if (durationHours < 6.5) {
        tips.push(
          `Only ~${durationHours}h in bed. Under ~7h, willpower for gym/Quran crashes — sleep debt is real.`
        );
        actions.push(
          `Target ${ideal} bedtime for an ${TARGET_HOURS}h night before ${wakeGoal}.`
        );
      } else if (durationHours < 7.5) {
        tips.push(
          `~${durationHours}h is borderline. Most adults feel sharper closer to 7.5–8.5h.`
        );
      } else if (durationHours <= 9) {
        tips.push(
          `~${durationHours}h is in a healthy range. Consistency matters more than chasing extra hours now.`
        );
      } else {
        tips.push(
          `~${durationHours}h may leave you groggy. Prefer a stable ${wakeGoal} wake over sleeping in.`
        );
      }
    }

    const noPhoneDone = Boolean(log?.checks?.noPhone ?? log?.noPhone);
    if (log && !noPhoneDone) {
      tips.push(
        "Phone in bed delays melatonin. Charge it outside the room — biggest free win for early rising."
      );
      actions.push("Phone out of bedroom tonight.");
    } else if (noPhoneDone) {
      tips.push("No-phone night helps sleep onset. Keep that rule non‑negotiable.");
    }

    // Pattern-aware tip from recent history
    const lateStreak = recentLogs
      .slice(-3)
      .filter(
        (l) =>
          l.bedtime && minutesPastSleepGoal(l.bedtime, sleepGoal) > 30
      ).length;
    if (lateStreak >= 2) {
      tips.push(
        "You’ve had multiple late nights in a row — your body clock is shifting later. Force the morning light + fixed wake to pull it back."
      );
    }
  }

  let summary = "Log sleep and wake to unlock a real night score.";
  if (bedtime || wakeTime) {
    const parts = [
      bedtime ? `slept ${bedtime}` : null,
      wakeTime ? `woke ${wakeTime}` : null,
      durationHours != null ? `${durationHours}h` : null,
    ].filter(Boolean);
    summary = `${label} (${score}/100) — ${parts.join(" · ")}.`;
    if (sleepDebtHours && sleepDebtHours > 0) {
      summary += ` About ${sleepDebtHours}h short of an ${TARGET_HOURS}h night.`;
    }
  }

  const highlights: string[] = [];
  if (durationHours != null) highlights.push(`${durationHours}h sleep`);
  if (score > 0) highlights.push(`Score ${score}`);
  if (sleepDebtHours && sleepDebtHours > 0)
    highlights.push(`${sleepDebtHours}h debt`);
  if (wakeTime && isBeforeOrAt(wakeTime, wakeGoal))
    highlights.push("Wake on time");
  if (bedtime && isSleepEarly(bedtime, sleepGoal))
    highlights.push("Bed on time");

  return {
    date,
    bedtime,
    wakeTime,
    sleepGoal,
    wakeGoal,
    grade,
    label,
    score,
    minutesPastGoal: minutesPast,
    minutesPastWakeGoal: minutesPastWake,
    durationHours,
    targetHours: TARGET_HOURS,
    sleepDebtHours,
    summary,
    tips: [...new Set(tips)].slice(0, 5),
    actions: [...new Set(actions)].slice(0, 3),
    highlights,
  };
}

export function buildWeekSleepReport(
  logs: HabitLogLike[],
  sleepGoal: string,
  wakeGoal: string
): SleepWeekReport {
  const withBed = logs.filter((l) => l.bedtime);
  const withWake = logs.filter((l) => l.wakeTime);
  const onTime = withBed.filter((l) =>
    isSleepEarly(l.bedtime!, sleepGoal)
  ).length;
  const wakeOnTime = withWake.filter((l) =>
    isBeforeOrAt(l.wakeTime!, wakeGoal)
  ).length;

  const durations = logs
    .filter((l) => l.bedtime && l.wakeTime)
    .map((l) => sleepDurationHours(l.bedtime!, l.wakeTime!));

  const avgDurationHours =
    durations.length > 0
      ? Math.round(
          (durations.reduce((a, b) => a + b, 0) / durations.length) * 10
        ) / 10
      : null;

  const sleepDebtHours =
    durations.length > 0
      ? Math.round(
          durations.reduce((a, d) => a + Math.max(0, TARGET_HOURS - d), 0) * 10
        ) / 10
      : 0;

  const wakeStd = stdDevMinutes(withWake.map((l) => l.wakeTime!));
  const consistencyScore =
    wakeStd == null
      ? 0
      : Math.max(0, Math.min(100, Math.round(100 - wakeStd * 1.5)));

  // Weekend vs weekday wake (social jetlag proxy)
  let socialJetlagMin: number | null = null;
  const weekdayWakes: number[] = [];
  const weekendWakes: number[] = [];
  for (const l of withWake) {
    const dow = new Date(l.date + "T12:00:00").getDay();
    const m = timeToMinutes(l.wakeTime!);
    if (dow === 0 || dow === 6) weekendWakes.push(m);
    else weekdayWakes.push(m);
  }
  if (weekdayWakes.length && weekendWakes.length) {
    const avg = (arr: number[]) =>
      arr.reduce((a, b) => a + b, 0) / arr.length;
    socialJetlagMin = Math.round(Math.abs(avg(weekendWakes) - avg(weekdayWakes)));
  }

  const rate =
    withBed.length === 0 ? 0 : Math.round((onTime / withBed.length) * 100);
  const wakeRate =
    withWake.length === 0
      ? 0
      : Math.round((wakeOnTime / withWake.length) * 100);

  const tips: string[] = [];
  if (withWake.length < 3) {
    tips.push("Log wake time for a few days — wake consistency is the #1 lever.");
  } else if (wakeRate >= 70 && consistencyScore >= 70) {
    tips.push(
      "Wake timing is consistent — this is how early rising becomes automatic."
    );
  } else if (wakeRate < 50) {
    tips.push(
      `Wake on time only ${wakeRate}% of days. Put the alarm across the room; no snooze for 7 days.`
    );
  }

  if (sleepDebtHours >= 3) {
    tips.push(
      `~${sleepDebtHours}h sleep debt this week. Don’t “catch up” with a huge lie-in — add 30–45 min earlier bedtime instead.`
    );
  }

  if (socialJetlagMin != null && socialJetlagMin >= 60) {
    tips.push(
      `Weekend wake drifts ~${socialJetlagMin} min later (social jetlag). Keep weekend wake within 45 min of ${wakeGoal}.`
    );
  }

  if (avgDurationHours != null && avgDurationHours < 7) {
    tips.push(
      `Avg ${avgDurationHours}h sleep. Move bedtime toward ${idealBedtimeForWake(wakeGoal)} — keep wake fixed.`
    );
  }

  if (rate < 40 && withBed.length >= 3) {
    tips.push(
      `On-time bedtime only ${rate}%. Use a wind-down alarm 60 min before ${sleepGoal}.`
    );
  }

  return {
    daysLogged: Math.max(withBed.length, withWake.length),
    avgBedtime: averageTime(withBed.map((l) => l.bedtime!)),
    avgWake: averageTime(withWake.map((l) => l.wakeTime!)),
    onTimeRate: rate,
    wakeOnTimeRate: wakeRate,
    avgDurationHours,
    consistencyScore,
    sleepDebtHours,
    socialJetlagMin,
    tips: [...new Set(tips)].slice(0, 4),
  };
}

/** Free local coach — no paid AI. Personalized from your logs + goals. */
export function buildCoachPlan(
  logs: HabitLogLike[],
  sleepGoal: string,
  wakeGoal: string
): CoachPlan {
  const week = buildWeekSleepReport(logs.slice(-14), sleepGoal, wakeGoal);
  const ideal = idealBedtimeForWake(wakeGoal, TARGET_HOURS);
  // Prefer goal bedtime if it's earlier/equal to ideal; else use ideal for 8h
  const goalMins = timeToMinutes(sleepGoal);
  const idealMins = timeToMinutes(ideal);
  // For evening goals, earlier = smaller... careful with overnight
  let tonightBed = sleepGoal;
  // If sleep goal wouldn't allow ~7.5h before wake, push earlier to ideal
  const hoursIfGoal = (() => {
    // fake duration sleepGoal -> wakeGoal
    return sleepDurationHours(sleepGoal, wakeGoal);
  })();
  if (hoursIfGoal < 7.5) tonightBed = ideal;

  // If they've been late, suggest 15–30 min earlier than their avg bedtime
  if (week.avgBedtime) {
    const avgPast = minutesPastSleepGoal(week.avgBedtime, tonightBed);
    if (avgPast > 20) {
      const step = Math.min(30, Math.max(15, Math.round(avgPast / 2)));
      tonightBed = minutesToHHMM(timeToMinutes(week.avgBedtime) - step);
    }
  }

  const wind = windDownTime(tonightBed, 60);
  void goalMins;
  void idealMins;

  let focus: CoachPlan["focus"] = "maintain";
  let headline = "Keep the streak — same wake, same wind-down.";
  let why =
    "Your pattern looks stable enough. Consistency compounds early rising.";

  if (week.daysLogged < 3) {
    focus = "protect_wake";
    headline = "Lock your wake time first.";
    why =
      "With little data, the highest-ROI move is a non‑negotiable morning alarm.";
  } else if (week.sleepDebtHours >= 4 || (week.avgDurationHours ?? 8) < 6.8) {
    focus = "recover";
    headline = "Recover sleep debt without sleeping in.";
    why =
      "Sleeping late tomorrow wrecks the next night. Earlier bed is the fix.";
  } else if (week.wakeOnTimeRate < 55) {
    focus = "protect_wake";
    headline = "Win the morning — wake is slipping.";
    why =
      "Late wakes shift your clock later and make tomorrow’s early rise harder.";
  } else if (week.onTimeRate < 50) {
    focus = "earlier_bed";
    headline = "Shift bedtime earlier in small steps.";
    why =
      "You’re waking okay some days but bedtime is late — that’s unsustainable.";
  } else if (week.consistencyScore < 55) {
    focus = "consistency";
    headline = "Stabilize wake time (±20 min).";
    why =
      "Variable wake times confuse your body clock more than one late night.";
  }

  const steps = [
    `Wind-down starts ${wind} (phone away, dim lights, Quran/reading ok).`,
    `In bed by ${tonightBed}.`,
    `Alarm ${wakeGoal} — out of bed in 2 minutes, light on eyes.`,
    "No snooze. If tired tonight, earlier bed — not later wake.",
  ];

  return {
    headline,
    why,
    tonightBed,
    windDown: wind,
    morningWake: wakeGoal,
    steps,
    focus,
  };
}

export type NightNeedStatus =
  | "unknown"
  | "short"
  | "minimum"
  | "on_plan"
  | "strong";

export type NightNeedTake = {
  minHours: number;
  targetHours: number;
  plannedHours: number;
  lastNightHours: number | null;
  weekAvgHours: number | null;
  takeHours: number | null;
  vsMinHours: number | null;
  vsTargetHours: number | null;
  vsPlannedHours: number | null;
  sleepDebtHours: number;
  nightsAtOrAboveMin: number;
  nightsLogged: number;
  status: NightNeedStatus;
  needHeadline: string;
  takeHeadline: string;
  gapLine: string;
  suggestion: string;
};

export type NightLogReport = {
  date: string;
  weekday: string;
  hours: number | null;
  bedtime: string | null;
  wakeTime: string | null;
  metMin: boolean;
  metPlan: boolean;
  score: number;
  label: string;
};

function weekdayShort(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short",
  });
}

function hoursLabel(n: number | null, empty = "—") {
  return n == null ? empty : `${n}h`;
}

function signedHours(n: number) {
  const abs = Math.abs(n);
  if (n > 0) return `+${abs}h`;
  if (n < 0) return `−${abs}h`;
  return "0h";
}

/** Pair previous bedtime with this morning’s wake — the real night you took. */
export function hoursFromPrevBedToWake(
  prevBedtime: string | null | undefined,
  wakeTime: string | null | undefined
): number | null {
  if (!prevBedtime || !wakeTime) return null;
  return sleepDurationHours(prevBedtime, wakeTime);
}

export function lastNightHours(
  logs: HabitLogLike[],
  today: string
): number | null {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const idx = sorted.findIndex((l) => l.date === today);
  const todayLog = idx >= 0 ? sorted[idx] : undefined;
  const prevLog = idx > 0 ? sorted[idx - 1] : undefined;
  const paired = hoursFromPrevBedToWake(prevLog?.bedtime, todayLog?.wakeTime);
  if (paired != null) return paired;
  if (todayLog?.bedtime && todayLog?.wakeTime) {
    return sleepDurationHours(todayLog.bedtime, todayLog.wakeTime);
  }
  return null;
}

export function buildNightLogReports(
  logs: HabitLogLike[],
  today: string,
  sleepGoal: string,
  wakeGoal: string,
  days = 7
): NightLogReport[] {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const byDate = new Map(sorted.map((l) => [l.date, l]));
  const planned = sleepDurationHours(sleepGoal, wakeGoal);
  const out: NightLogReport[] = [];
  const end = new Date(today + "T12:00:00");

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const date = formatLocalDate(d);
    const cur = byDate.get(date);
    const prevDate = new Date(d);
    prevDate.setDate(d.getDate() - 1);
    const prevKey = formatLocalDate(prevDate);
    const prev = byDate.get(prevKey);
    const hours =
      hoursFromPrevBedToWake(prev?.bedtime, cur?.wakeTime) ??
      (cur?.bedtime && cur?.wakeTime
        ? sleepDurationHours(cur.bedtime, cur.wakeTime)
        : null);
    const day = buildDaySleepReport(cur, date, sleepGoal, wakeGoal, sorted);
    out.push({
      date,
      weekday: weekdayShort(date),
      hours,
      bedtime: prev?.bedtime ?? cur?.bedtime ?? null,
      wakeTime: cur?.wakeTime ?? null,
      metMin: hours != null && hours >= MIN_SLEEP_HOURS,
      metPlan: hours != null && hours >= Math.min(planned, TARGET_HOURS) - 0.2,
      score: day.score,
      label: day.label,
    });
  }
  return out;
}

export function buildNightNeedTake(
  logs: HabitLogLike[],
  today: string,
  sleepGoal: string,
  wakeGoal: string
): NightNeedTake {
  const plannedHours = sleepDurationHours(sleepGoal, wakeGoal);
  const nightRows = buildNightLogReports(logs, today, sleepGoal, wakeGoal, 7);
  const lastNightHoursValue = lastNightHours(logs, today);
  const loggedHours = nightRows
    .map((n) => n.hours)
    .filter((h): h is number => h != null);
  const weekAvgHours =
    loggedHours.length > 0
      ? Math.round(
          (loggedHours.reduce((a, b) => a + b, 0) / loggedHours.length) * 10
        ) / 10
      : null;
  const takeHours = lastNightHoursValue ?? weekAvgHours;
  const nightsLogged = loggedHours.length;
  const nightsAtOrAboveMin = nightRows.filter((n) => n.metMin).length;
  const sleepDebtHours =
    loggedHours.length > 0
      ? Math.round(
          loggedHours.reduce((a, d) => a + Math.max(0, TARGET_HOURS - d), 0) *
            10
        ) / 10
      : 0;

  const vsMinHours =
    takeHours != null
      ? Math.round((takeHours - MIN_SLEEP_HOURS) * 10) / 10
      : null;
  const vsTargetHours =
    takeHours != null
      ? Math.round((takeHours - TARGET_HOURS) * 10) / 10
      : null;
  const vsPlannedHours =
    takeHours != null
      ? Math.round((takeHours - plannedHours) * 10) / 10
      : null;

  let status: NightNeedStatus = "unknown";
  if (takeHours != null) {
    if (takeHours < MIN_SLEEP_HOURS) status = "short";
    else if (takeHours >= 7.5 && takeHours <= 9) status = "strong";
    else if (takeHours >= Math.min(plannedHours, TARGET_HOURS) - 0.2)
      status = "on_plan";
    else status = "minimum";
  }

  const needHeadline = `${plannedHours}h planned · ${MIN_SLEEP_HOURS}h minimum`;
  const takeHeadline =
    lastNightHoursValue != null
      ? `${lastNightHoursValue}h last night`
      : weekAvgHours != null
        ? `${weekAvgHours}h avg this week`
        : "Not logged yet";

  let gapLine = "Log bedtime and wake to see need vs take.";
  if (takeHours != null && vsMinHours != null) {
    if (status === "short") {
      gapLine = `You took ${hoursLabel(takeHours)} — ${signedHours(vsMinHours)} under the ${MIN_SLEEP_HOURS}h minimum.`;
    } else if (vsPlannedHours != null && vsPlannedHours < -0.2) {
      gapLine = `You took ${hoursLabel(takeHours)}. Plan is ${plannedHours}h (${sleepGoal} → ${wakeGoal}) — ${signedHours(vsPlannedHours)}.`;
    } else if (vsTargetHours != null && vsTargetHours < -0.2) {
      gapLine = `You cleared the ${MIN_SLEEP_HOURS}h floor. ${signedHours(vsTargetHours)} short of the ${TARGET_HOURS}h target.`;
    } else {
      gapLine = `You took ${hoursLabel(takeHours)} — at or above what this night needs.`;
    }
  }

  const ideal = idealBedtimeForWake(wakeGoal, TARGET_HOURS);
  let suggestion: string;
  if (status === "unknown") {
    suggestion = `Need at least ${MIN_SLEEP_HOURS}h, plan ${plannedHours}h. In bed by ${sleepGoal} (ideal ${ideal}) so you can take a full night before ${wakeGoal}.`;
  } else if (status === "short") {
    suggestion = `You are under the ${MIN_SLEEP_HOURS}h minimum. Shift bedtime toward ${ideal} — keep wake at ${wakeGoal}. Do not sleep in.`;
  } else if (status === "minimum") {
    suggestion = `You hit the floor, not the plan. Wind down earlier and be in bed by ${sleepGoal} for ${plannedHours}h.`;
  } else if (status === "on_plan") {
    suggestion = `Plan is holding. Same bed window tonight (${sleepGoal}) and the same ${wakeGoal} alarm.`;
  } else {
    suggestion = `Strong take. Protect it: phone out, wind-down before ${sleepGoal}, wake ${wakeGoal}.`;
  }

  return {
    minHours: MIN_SLEEP_HOURS,
    targetHours: TARGET_HOURS,
    plannedHours,
    lastNightHours: lastNightHoursValue,
    weekAvgHours,
    takeHours,
    vsMinHours,
    vsTargetHours,
    vsPlannedHours,
    sleepDebtHours,
    nightsAtOrAboveMin,
    nightsLogged,
    status,
    needHeadline,
    takeHeadline,
    gapLine,
    suggestion,
  };
}
