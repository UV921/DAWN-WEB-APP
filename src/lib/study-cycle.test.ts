import assert from "node:assert/strict";
import {
  formatHourLabel,
  formatHourRange,
  minutesByHourByDate,
  peakHour,
  rollingHourWindow,
  serializeHourly,
  studyCycleInsight,
  sumHourlyRows,
} from "./study-cycle";

const TZ = "Asia/Kolkata";

/** 08:00 IST on 2026-08-20. */
const morning = new Date("2026-08-20T02:30:00.000Z");
/** 10:30 IST on 2026-08-20. */
const midMorning = new Date("2026-08-20T05:00:00.000Z");
/** 23:30 IST on 2026-08-20. */
const late = new Date("2026-08-20T18:00:00.000Z");
/** 00:45 IST on 2026-08-21. */
const afterMidnight = new Date("2026-08-20T19:15:00.000Z");

const morningHours = minutesByHourByDate(
  [{ startedAt: morning, endedAt: midMorning }],
  TZ
);
assert.equal(morningHours.size, 1, "one local date");
const day = morningHours.get("2026-08-20");
assert.ok(day, "mapped to 20 Aug");
assert.equal(Math.round(day[8]), 60, "08:00 hour gets 60m");
assert.equal(Math.round(day[9]), 60, "09:00 hour gets 60m");
assert.equal(Math.round(day[10]), 30, "10:00 hour gets 30m");
assert.equal(Math.round(day[7]), 0, "07:00 stays empty");
assert.equal(Math.round(day.reduce((a, n) => a + n, 0)), 150, "2h 30m total");

const overnight = minutesByHourByDate(
  [{ startedAt: late, endedAt: afterMidnight }],
  TZ
);
assert.equal(Math.round(overnight.get("2026-08-20")?.[23] || 0), 30);
assert.equal(Math.round(overnight.get("2026-08-21")?.[0] || 0), 45);
assert.equal(overnight.get("2026-08-20")?.[0] || 0, 0, "start date night hour 0 empty");

const live = minutesByHourByDate(
  [{ startedAt: morning, endedAt: null }],
  TZ,
  midMorning
);
assert.equal(Math.round(live.get("2026-08-20")?.[8] || 0), 60);

const serialized = serializeHourly(morningHours);
assert.equal(serialized[0].date, "2026-08-20");
assert.equal(serialized[0].hours[8], 60);

const summed = sumHourlyRows(serialized, new Set(["2026-08-20"]));
assert.equal(Math.round(summed[8]), 60);
assert.equal(
  sumHourlyRows(serialized, new Set(["2026-08-21"])).reduce((a, n) => a + n, 0),
  0
);

assert.equal(formatHourLabel(0), "12am");
assert.equal(formatHourLabel(8), "8am");
assert.equal(formatHourLabel(12), "12pm");
assert.equal(formatHourLabel(18), "6pm");
assert.equal(formatHourRange(8, 11), "8am–11am");
assert.equal(formatHourRange(22, 1), "10pm–1am");

assert.equal(peakHour(day!), 8);
const peak = rollingHourWindow(day!, 3, "max");
assert.ok(peak);
assert.equal(peak.start, 8);
assert.equal(peak.end, 11);
assert.equal(Math.round(peak.minutes), 150);

const emptyInsight = studyCycleInsight(Array.from({ length: 24 }, () => 0));
assert.equal(emptyInsight.peakBand, null);
assert.match(emptyInsight.headline, /No study hours/);

const insight = studyCycleInsight(day!);
assert.equal(insight.peakBand?.key, "morning");
assert.match(insight.headline, /morning/i);
assert.match(insight.headline, /8am–11am/);
assert.ok(insight.quietWindow);
assert.equal(insight.bands.find((b) => b.key === "morning")?.pct, 100);

console.log("study-cycle tests passed");
