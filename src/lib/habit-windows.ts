/** Time windows for when a habit can be logged (and earn progress). */

import { minsInZone } from "@/lib/clock";

export type HabitWindow = {
  start: string; // HH:MM
  end: string; // HH:MM
  source: "custom" | "default";
};

export type WindowStatus = "open" | "upcoming" | "closed";

export type HabitWithWindow = {
  key: string;
  label: string;
  windowStart?: string | null;
  windowEnd?: string | null;
};

function parseMins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return ((h % 24) * 60 + (m % 60) + 24 * 60) % (24 * 60);
}

/** 00:00 as an *end* time means midnight tonight (24:00), not 12:00am as start of day. */
function parseEndMins(end: string, startMins: number): number {
  const e = parseMins(end);
  if (e === 0 && startMins > 0) return 24 * 60;
  return e;
}

export function formatMins(total: number): string {
  const n = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function nowMins(d = new Date(), timeZone?: string): number {
  if (timeZone) return minsInZone(timeZone, d);
  return d.getHours() * 60 + d.getMinutes();
}

/** True if `t` is inside [start, end], supporting overnight wrap. */
export function isInWindow(t: string | number, start: string, end: string): boolean {
  const tm = typeof t === "number" ? t : parseMins(t);
  const s = parseMins(start);
  const e = parseEndMins(end, s);
  if (s === e) return true; // full day
  if (s < e) return tm >= s && tm <= e;
  return tm >= s || tm <= e;
}

export function minutesUntilOpen(now: number, start: string, end: string): number {
  if (isInWindow(now, start, end)) return 0;
  const s = parseMins(start);
  return (s - now + 24 * 60) % (24 * 60);
}

export function minutesUntilClose(now: number, start: string, end: string): number {
  if (!isInWindow(now, start, end)) return 0;
  const s = parseMins(start);
  const e = parseEndMins(end, s);
  return (e - now + 24 * 60) % (24 * 60);
}

/**
 * Default windows relative to wake/sleep goals.
 * Sleep habits open around bedtime; morning habits around wake.
 */
export function defaultWindowForKey(
  key: string,
  wakeGoal: string,
  sleepGoal: string
): HabitWindow {
  const wake = parseMins(wakeGoal || "06:00");
  const sleep = parseMins(sleepGoal || "23:00");

  if (key === "sleepEarly" || key === "bedtime") {
    return {
      start: formatMins(sleep - 90),
      end: formatMins(sleep + 90),
      source: "default",
    };
  }
  if (key === "wakeEarly") {
    return {
      start: formatMins(wake - 60),
      end: formatMins(wake + 150),
      source: "default",
    };
  }
  if (key === "noPhone") {
    // Phone discipline: first stretch after wake
    return {
      start: formatMins(wake),
      end: formatMins(wake + 120),
      source: "default",
    };
  }
  if (key === "fajr") {
    return {
      start: formatMins(wake - 90),
      end: formatMins(wake + 90),
      source: "default",
    };
  }
  // Gym / reading / quran / walk / journal / custom → morning block
  return {
    start: formatMins(wake - 30),
    end: formatMins(wake + 240),
    source: "default",
  };
}

/** Today’s planned wake, if set, else the settings goal. */
export function effectiveWakeGoal(
  planWake: string | null | undefined,
  settingsWake: string | null | undefined
): string {
  if (planWake && /^\d{2}:\d{2}$/.test(planWake)) return planWake;
  if (settingsWake && /^\d{2}:\d{2}$/.test(settingsWake)) return settingsWake;
  return "06:00";
}

export function resolveHabitWindow(
  habit: HabitWithWindow,
  wakeGoal: string,
  sleepGoal: string
): HabitWindow {
  if (habit.windowStart && habit.windowEnd) {
    return {
      start: habit.windowStart,
      end: habit.windowEnd,
      source: "custom",
    };
  }
  return defaultWindowForKey(habit.key, wakeGoal, sleepGoal);
}

export function windowStatus(
  win: HabitWindow,
  now: number = nowMins()
): {
  status: WindowStatus;
  label: string;
  opensInMin: number;
  closesInMin: number;
} {
  if (isInWindow(now, win.start, win.end)) {
    const closes = minutesUntilClose(now, win.start, win.end);
    return {
      status: "open",
      label: `Open now · until ${win.end}`,
      opensInMin: 0,
      closesInMin: closes,
    };
  }
  const opens = minutesUntilOpen(now, win.start, win.end);
  // If we're past today's window and next open is tomorrow morning-ish,
  // call it closed for today when the next open is farther than the window length
  // and we already passed end today without wrap complexity — keep simple:
  // "upcoming" always when closed, with next open time.
  return {
    status: "upcoming",
    label: `Opens ${win.start}–${win.end}`,
    opensInMin: opens,
    closesInMin: 0,
  };
}

export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Wake/bed log must be close to "now" — no backdating for progress. */
export function isHonestClockTime(
  chosen: string,
  now: Date | number = new Date(),
  graceMins = 20,
  timeZone?: string
): boolean {
  const chosenM = parseMins(chosen);
  const nowM = typeof now === "number" ? now : nowMins(now, timeZone);
  const diff = Math.min(
    Math.abs(chosenM - nowM),
    24 * 60 - Math.abs(chosenM - nowM)
  );
  return diff <= graceMins;
}

export function enrichHabitsWithWindows<
  T extends HabitWithWindow & Record<string, unknown>,
>(
  habits: T[],
  wakeGoal: string,
  sleepGoal: string,
  now = new Date(),
  timeZone?: string
) {
  const nm = nowMins(now, timeZone);
  return habits.map((h) => {
    const window = resolveHabitWindow(h, wakeGoal, sleepGoal);
    const st = windowStatus(window, nm);
    return {
      ...h,
      windowStart: window.start,
      windowEnd: window.end,
      windowSource: window.source,
      windowStatus: st.status,
      windowLabel: st.label,
      opensInMin: st.opensInMin,
      closesInMin: st.closesInMin,
      canSubmit: st.status === "open",
    };
  });
}
