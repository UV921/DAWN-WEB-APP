import assert from "node:assert/strict";
import {
  averageRatioPcts,
  buildDayRatios,
  clampDayIso,
  dayScore,
  lastNDatesEnding,
  sleepHoursFromTimes,
  studyRatioPct,
  wakeRatioPct,
} from "./day-progress";

const onTime = wakeRatioPct("06:00", "06:00");
assert.equal(onTime.pct, 100);
assert.equal(onTime.scored, true);
assert.equal(onTime.lateMin, 0);

const early = wakeRatioPct("05:30", "06:00");
assert.equal(early.pct, 100);
assert.ok((early.lateMin ?? 0) < 0);

const hourLate = wakeRatioPct("07:00", "06:00");
assert.equal(hourLate.pct, 50);
assert.equal(hourLate.lateMin, 60);

const twoHoursLate = wakeRatioPct("08:00", "06:00");
assert.equal(twoHoursLate.pct, 0);

const missingWake = wakeRatioPct(null, "06:00");
assert.equal(missingWake.scored, false);
assert.equal(missingWake.pct, 0);

assert.equal(studyRatioPct(0), 0);
assert.equal(studyRatioPct(60), 50);
assert.equal(studyRatioPct(120), 100);
assert.equal(studyRatioPct(180), 100);

assert.equal(sleepHoursFromTimes("23:00", "06:00"), 7);
assert.equal(sleepHoursFromTimes("22:30", "06:00"), 7.5);
assert.equal(sleepHoursFromTimes(null, "06:00"), null);
assert.equal(sleepHoursFromTimes("23:00", "23:30"), null, "too short to count");

const full = buildDayRatios({
  wakeTime: "06:00",
  wakeGoal: "06:00",
  bedtime: "23:00",
  sleepGoal: "23:00",
  sleepHours: 7,
  habitsDone: 6,
  habitsTotal: 6,
  tasksDone: 3,
  tasksTotal: 4,
  studyMins: 90,
  logged: true,
});
assert.equal(full.find((r) => r.key === "wake")?.pct, 100);
assert.equal(full.find((r) => r.key === "habits")?.pct, 100);
assert.equal(full.find((r) => r.key === "tasks")?.pct, 75);
assert.equal(full.find((r) => r.key === "study")?.pct, 75);
assert.equal(full.find((r) => r.key === "sleep")?.pct, 100);
assert.equal(dayScore(full), 90);

const empty = buildDayRatios({
  wakeTime: null,
  wakeGoal: "06:00",
  bedtime: null,
  sleepGoal: "23:00",
  sleepHours: null,
  habitsDone: 0,
  habitsTotal: 6,
  tasksDone: 0,
  tasksTotal: 0,
  studyMins: 0,
  logged: false,
});
assert.equal(dayScore(empty), null, "nothing scored on a blank day");
assert.equal(empty.find((r) => r.key === "habits")?.scored, false);
assert.equal(empty.find((r) => r.key === "tasks")?.scored, false);

const avg = averageRatioPcts([full, empty]);
assert.equal(avg.wake, 100, "unscored days do not dilute wake");
assert.equal(avg.habits, 100);
assert.equal(avg.tasks, 75);

assert.deepEqual(lastNDatesEnding("2026-08-24", 3), [
  "2026-08-22",
  "2026-08-23",
  "2026-08-24",
]);
assert.equal(clampDayIso("2026-09-01", "2026-08-24"), "2026-08-24");
assert.equal(clampDayIso("2026-08-20", "2026-08-24"), "2026-08-20");
assert.equal(clampDayIso("nope", "2026-08-24"), "2026-08-24");

console.log("day-progress tests passed");
