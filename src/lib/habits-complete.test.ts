import assert from "node:assert/strict";
import {
  completedCount,
  isHabitComplete,
  isHabitDone,
  isPerfectDay,
  type HabitLogLike,
} from "./habits";
import {
  effectiveWakeGoal,
  isLeftoverOvernightSleep,
} from "./habit-windows";

const keys = ["wakeEarly", "gym", "reading", "noPhone"];

const lateWake: HabitLogLike = {
  date: "2026-08-20",
  wakeTime: "07:15",
  bedtime: null,
  checks: {
    wakeEarly: false,
    gym: true,
    reading: true,
    noPhone: true,
  },
};

assert.equal(isHabitDone(lateWake, "wakeEarly"), false, "on-time flag stays false");
assert.equal(isHabitComplete(lateWake, "wakeEarly"), true, "logged wake counts");
assert.equal(completedCount(lateWake, keys), 4, "4/4 when wake is logged");
assert.equal(isPerfectDay(lateWake, keys), true, "perfect day with logged wake");

const noWake: HabitLogLike = {
  ...lateWake,
  wakeTime: null,
  checks: { ...lateWake.checks, gym: true, reading: true, noPhone: true },
};
assert.equal(completedCount(noWake, keys), 3, "3/4 without wake log");
assert.equal(isPerfectDay(noWake, keys), false);

const bedtimeOnly: HabitLogLike = {
  date: "2026-08-20",
  wakeTime: "06:30",
  bedtime: "00:40",
  checks: { wakeEarly: true, sleepEarly: false, gym: true, fajr: true },
};
assert.equal(
  isHabitComplete(bedtimeOnly, "sleepEarly"),
  false,
  "bedtime alone does not tick Sleep early"
);

const sleepWin = { start: "22:30", end: "01:00" };
const leftoverSleep: HabitLogLike = {
  date: "2026-08-20",
  wakeTime: "06:30",
  bedtime: "00:40",
  checks: {
    wakeEarly: true,
    sleepEarly: true,
    gym: true,
    fajr: true,
  },
};
assert.equal(
  isLeftoverOvernightSleep("00:40", sleepWin, 8 * 60),
  true,
  "00:40 bedtime is leftover at 08:00"
);
assert.equal(
  isLeftoverOvernightSleep("00:40", sleepWin, 22 * 60 + 40),
  true,
  "00:40 bedtime is leftover once tonight’s window opens"
);
assert.equal(
  isLeftoverOvernightSleep("00:40", sleepWin, 40),
  false,
  "same after-midnight close is not leftover"
);
assert.equal(
  isHabitComplete(leftoverSleep, "sleepEarly", {
    now: 8 * 60,
    sleepWindow: sleepWin,
  }),
  false,
  "sleep habit is not done in the morning"
);
assert.equal(
  isHabitComplete(leftoverSleep, "sleepEarly", {
    now: 23 * 60,
    sleepWindow: sleepWin,
  }),
  false,
  "last night’s after-midnight close is not tonight’s sleep"
);
assert.equal(
  isHabitComplete(leftoverSleep, "sleepEarly", {
    now: 40,
    sleepWindow: sleepWin,
  }),
  true,
  "sleep still counts in the same after-midnight close"
);

assert.equal(effectiveWakeGoal("07:00", "06:00"), "07:00");
assert.equal(effectiveWakeGoal(null, "06:00"), "06:00");
assert.equal(effectiveWakeGoal("", "06:30"), "06:30");

console.log("habits-complete tests passed");
