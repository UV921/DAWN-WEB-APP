import { formatDateInZone, zonedClock, DEFAULT_TZ } from "./clock";
import { collectChannelIds } from "./bot-messages";

/** Ignore join/leave flicker. */
export const MIN_SESSION_MS = 2 * 60 * 1000;
/** Cap a ghost session (bot missed a leave). Live study can continue past this. */
export const MAX_SESSION_MS = 6 * 60 * 60 * 1000;

export function parseStudyVoiceIds(raw?: string | null): string[] {
  if (!raw) return [];
  return collectChannelIds(...String(raw).split(/[,;\n]+/));
}

export function envStudyVoiceIds(): string[] {
  return parseStudyVoiceIds(process.env.DISCORD_STUDY_VOICE_IDS);
}

export function addCalendarDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/** UTC instant when the clock in `timeZone` reads `date` 00:00. */
export function localMidnightUtc(date: string, timeZone: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  let ms = Date.UTC(y, mo - 1, d, 0, 0, 0);
  for (let i = 0; i < 8; i++) {
    const clock = zonedClock(timeZone, new Date(ms));
    if (clock.date === date && clock.hhmm === "00:00") return new Date(ms);
    const [gy, gmo, gd] = clock.date.split("-").map(Number);
    const [gh, gm] = clock.hhmm.split(":").map(Number);
    const got = Date.UTC(gy, gmo - 1, gd, gh, gm, 0);
    const want = Date.UTC(y, mo - 1, d, 0, 0, 0);
    const delta = want - got;
    if (delta === 0) return new Date(ms);
    ms += delta;
  }
  return new Date(ms);
}

export function overlapMinutes(
  start: Date,
  end: Date,
  windowStart: Date,
  windowEnd: Date
): number {
  const a = Math.max(start.getTime(), windowStart.getTime());
  const b = Math.min(end.getTime(), windowEnd.getTime());
  if (b <= a) return 0;
  return (b - a) / 60_000;
}

export function minutesOnLocalDate(opts: {
  startedAt: Date;
  endedAt: Date;
  date: string;
  timeZone: string;
}): number {
  const tz = opts.timeZone || DEFAULT_TZ;
  const winStart = localMidnightUtc(opts.date, tz);
  const winEnd = localMidnightUtc(addCalendarDays(opts.date, 1), tz);
  return overlapMinutes(opts.startedAt, opts.endedAt, winStart, winEnd);
}

export function formatStudyDuration(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h <= 0) return `${rest}m`;
  if (rest === 0) return `${h}h`;
  return `${h}h ${rest}m`;
}

export function sessionMinutes(startedAt: Date, endedAt: Date): number {
  const ms = Math.min(
    MAX_SESSION_MS,
    Math.max(0, endedAt.getTime() - startedAt.getTime())
  );
  return Math.round(ms / 60_000);
}

export function lastNDates(today: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addCalendarDays(today, -i));
  return out;
}

export function todayInZone(timeZone?: string | null): string {
  return formatDateInZone(timeZone || DEFAULT_TZ);
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function startOfYear(iso: string): string {
  return `${iso.slice(0, 4)}-01-01`;
}
