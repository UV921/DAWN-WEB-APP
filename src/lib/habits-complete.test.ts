import assert from "node:assert/strict";
import {
  completedCount,
  isHabitComplete,
  isHabitDone,
  isPerfectDay,
  type HabitLogLike,
} from "./habits";
import { effectiveWakeGoal } from "./habit-windows";

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

assert.equal(effectiveWakeGoal("07:00", "06:00"), "07:00");
assert.equal(effectiveWakeGoal(null, "06:00"), "06:00");
assert.equal(effectiveWakeGoal("", "06:30"), "06:30");

console.log("habits-complete tests passed");
