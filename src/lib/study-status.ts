import { formatStudyDuration } from "./study-time";

export type StudyStatusTone = "live" | "good" | "thin" | "empty" | "setup";

export type StudyStatus = {
  tone: StudyStatusTone;
  kicker: string;
  headline: string;
  body: string;
};

export function buildStudyStatus(opts: {
  configured: boolean;
  hasDiscord: boolean;
  live: boolean;
  todayMinutes: number;
  weekMinutes: number;
  weekDaysWithStudy: number;
  bestDayMinutes: number;
  activity?: string | null;
}): StudyStatus {
  if (!opts.hasDiscord) {
    return {
      tone: "setup",
      kicker: "Not linked",
      headline: "Discord isn’t linked, so hours can’t start.",
      body: "Study time is counted when you sit in a marked voice channel. Sign in with Discord so Dawn can see you there.",
    };
  }
  if (!opts.configured) {
    return {
      tone: "setup",
      kicker: "No rooms",
      headline: "No study room is marked yet.",
      body: "In Discord run /study-room add, or paste voice channel IDs in Settings → Discord. Then join that VC — Dawn counts while the bot is online.",
    };
  }
  if (opts.live) {
    const doing = opts.activity?.trim();
    return {
      tone: "live",
      kicker: doing ? doing : "In session",
      headline: doing
        ? `${doing} · ${formatStudyDuration(opts.todayMinutes)} today.`
        : `You’re in a study room · ${formatStudyDuration(opts.todayMinutes)} today.`,
      body: doing
        ? "Time is counting. Change what you’re doing here, in the Discord ping, or with /doing."
        : "Dawn asked what you’re doing in Discord. Tap Coding or write it — or set it here.",
    };
  }
  if (opts.todayMinutes <= 0 && opts.weekMinutes <= 0) {
    return {
      tone: "empty",
      kicker: "Waiting",
      headline: "No study time this week yet.",
      body: "Join a marked study voice channel — Dawn pings you to ask what you’re doing. Or tap Start on Today. The first two minutes don’t count (join-leave flicker).",
    };
  }
  if (opts.todayMinutes <= 0) {
    return {
      tone: "thin",
      kicker: "Not started",
      headline: "You haven’t sat down today.",
      body: `This week is already ${formatStudyDuration(opts.weekMinutes)} across ${opts.weekDaysWithStudy} day${opts.weekDaysWithStudy === 1 ? "" : "s"}. One honest block now keeps the week from slipping.`,
    };
  }
  if (opts.todayMinutes < 25) {
    return {
      tone: "thin",
      kicker: "Warm-up",
      headline: `${formatStudyDuration(opts.todayMinutes)} today — a start, not a session.`,
      body: `Stay through one 25-minute block so it counts as real work. Week so far: ${formatStudyDuration(opts.weekMinutes)}.`,
    };
  }
  if (opts.todayMinutes < 90) {
    return {
      tone: "good",
      kicker: "On the clock",
      headline: `${formatStudyDuration(opts.todayMinutes)} in. That’s a real block.`,
      body: `Week total ${formatStudyDuration(opts.weekMinutes)}. Best day this week: ${formatStudyDuration(opts.bestDayMinutes)}.`,
    };
  }
  return {
    tone: "good",
    kicker: "Deep day",
    headline: `${formatStudyDuration(opts.todayMinutes)} today. That’s a deep day.`,
    body: `Week is ${formatStudyDuration(opts.weekMinutes)} across ${opts.weekDaysWithStudy} days. Protect sleep so tomorrow isn’t a crash.`,
  };
}

export function studyStreak(days: { minutes: number }[]): number {
  if (!days.length) return 0;
  let i = days.length - 1;
  if ((days[i]?.minutes || 0) <= 0) i -= 1;
  let n = 0;
  while (i >= 0 && (days[i]?.minutes || 0) > 0) {
    n += 1;
    i -= 1;
  }
  return n;
}
