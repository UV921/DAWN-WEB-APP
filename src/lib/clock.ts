/** User-timezone clock. Server Node is often UTC; habits must use the profile TZ. */

export const DEFAULT_TZ = "Asia/Kolkata";

function part(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): string {
  return parts.find((p) => p.type === type)?.value || "";
}

export function zonedClock(timeZone = DEFAULT_TZ, at = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(at);
    const y = part(parts, "year");
    const mo = part(parts, "month");
    const d = part(parts, "day");
    let h = Number(part(parts, "hour"));
    const m = Number(part(parts, "minute"));
    if (h === 24) h = 0;
    if (!y || !mo || !d || !Number.isFinite(h) || !Number.isFinite(m)) {
      throw new Error("bad tz");
    }
    return {
      date: `${y}-${mo}-${d}`,
      hhmm: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
      mins: ((h % 24) * 60 + (m % 60) + 24 * 60) % (24 * 60),
    };
  } catch {
    return {
      date: `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`,
      hhmm: `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`,
      mins: at.getHours() * 60 + at.getMinutes(),
    };
  }
}

export function formatDateInZone(timeZone?: string, at = new Date()) {
  return zonedClock(timeZone || DEFAULT_TZ, at).date;
}

export function minsInZone(timeZone?: string, at = new Date()) {
  return zonedClock(timeZone || DEFAULT_TZ, at).mins;
}
