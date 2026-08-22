/**
 * Interval care pings while a study session is live.
 *
 * Discord and Web Push are sent by the bot (and /api ticks) so they still
 * fire when Dawn is fully closed. The first open of Dawn on a device
 * subscribes that browser for push.
 */

export const MIN_STUDY_NUDGE_MINUTES = 1;
export const MAX_STUDY_NUDGE_MINUTES = 12 * 60;
export const MAX_STUDY_NUDGES = 8;

export const STUDY_NUDGE_PRESETS = [
  {
    key: "water",
    title: "Drink water",
    message: "Take a sip. Keep the session going.",
    intervalMinutes: 20,
  },
  {
    key: "eyes",
    title: "Rest your eyes",
    message: "Blink and look 20 feet away for 20 seconds.",
    intervalMinutes: 20,
  },
  {
    key: "stretch",
    title: "Stretch",
    message: "Roll your shoulders. Unclench your jaw. Sit tall.",
    intervalMinutes: 45,
  },
] as const;

export type StudyNudgePresetKey = (typeof STUDY_NUDGE_PRESETS)[number]["key"];

export type StudyNudgeRow = {
  id: string;
  title: string;
  message: string;
  intervalMinutes: number;
  enabled: boolean;
  notifyBrowser: boolean;
  notifyDiscord: boolean;
  discordTarget: string;
  presetKey: string | null;
};

const PRESET_KEYS = new Set<string>(STUDY_NUDGE_PRESETS.map((p) => p.key));
const TARGETS = new Set(["channel", "dm", "both"]);

export function isStudyNudgePresetKey(raw: unknown): raw is StudyNudgePresetKey {
  return PRESET_KEYS.has(String(raw || ""));
}

export function clampStudyNudgeMinutes(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 20;
  return Math.min(
    MAX_STUDY_NUDGE_MINUTES,
    Math.max(MIN_STUDY_NUDGE_MINUTES, Math.round(n))
  );
}

/** Parse "20" + "min" or "1" + "hr" into stored minutes. */
export function minutesFromIntervalInput(
  amount: unknown,
  unit: unknown
): number {
  const n = typeof amount === "number" ? amount : Number(amount);
  const u = String(unit || "min").toLowerCase();
  const minutes = u === "hr" || u === "hour" || u === "hours" ? n * 60 : n;
  return clampStudyNudgeMinutes(minutes);
}

export function intervalInputFromMinutes(minutes: number): {
  amount: number;
  unit: "min" | "hr";
} {
  const n = clampStudyNudgeMinutes(minutes);
  if (n >= 60 && n % 60 === 0) return { amount: n / 60, unit: "hr" };
  return { amount: n, unit: "min" };
}

export function formatStudyNudgeInterval(minutes: number): string {
  const n = clampStudyNudgeMinutes(minutes);
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function normalizeDiscordTarget(
  raw: unknown,
  fallback = "channel"
): "channel" | "dm" | "both" {
  const s = String(raw || "").toLowerCase();
  if (TARGETS.has(s)) return s as "channel" | "dm" | "both";
  if (TARGETS.has(fallback)) return fallback as "channel" | "dm" | "both";
  return "channel";
}

/**
 * Next fire instant: interval after session start, then after each server fire
 * (Discord + Web Push) during this session. A fire from an older session is ignored.
 */
export function studyNudgeDueAt(
  sessionStartedAt: Date,
  lastFiredAt: Date | null | undefined,
  intervalMinutes: number
): Date {
  const intervalMs = clampStudyNudgeMinutes(intervalMinutes) * 60_000;
  const started = sessionStartedAt.getTime();
  const last = lastFiredAt ? lastFiredAt.getTime() : NaN;
  const anchor = Number.isFinite(last) && last >= started ? last : started;
  return new Date(anchor + intervalMs);
}

export function isStudyNudgeDue(opts: {
  now: Date;
  sessionStartedAt: Date;
  lastFiredAt?: Date | null;
  intervalMinutes: number;
}): boolean {
  return (
    opts.now.getTime() >=
    studyNudgeDueAt(
      opts.sessionStartedAt,
      opts.lastFiredAt,
      opts.intervalMinutes
    ).getTime()
  );
}

/** 1-based slot since session start — used to de-dupe browser alerts. */
export function studyNudgeBrowserSlot(
  sessionStartedAt: Date,
  now: Date,
  intervalMinutes: number
): number {
  const intervalMs = clampStudyNudgeMinutes(intervalMinutes) * 60_000;
  const elapsed = now.getTime() - sessionStartedAt.getTime();
  if (elapsed < intervalMs) return 0;
  return Math.floor(elapsed / intervalMs);
}

export function studyNudgePresetByKey(key: string) {
  return STUDY_NUDGE_PRESETS.find((p) => p.key === key) || null;
}
