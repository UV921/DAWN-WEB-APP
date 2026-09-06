import assert from "node:assert/strict";
import {
  buildConsistencyDay,
  buildWeekConsistency,
  consistencyLevel,
  tallyTodos,
} from "./consistency";
import type { HabitLogLike } from "./habits";

const keys = ["wakeEarly", "gym", "reading", "noPhone"];

assert.equal(
  consistencyLevel({
    habitsDone: 0,
    habitsTotal: 4,
    tasksDone: 0,
    tasksTotal: 0,
    studyMinutes: 0,
    wakeTime: null,
    wakeEarly: false,
    logged: false,
  }),
  0,
  "empty day is 0"
);

const strong = consistencyLevel({
  habitsDone: 4,
  habitsTotal: 4,
  tasksDone: 2,
  tasksTotal: 3,
  studyMinutes: 40,
  wakeTime: "05:50",
  wakeEarly: true,
  logged: true,
});
assert.equal(strong, 4, "full morning + tasks + study caps at 4");

const half = consistencyLevel({
  habitsDone: 2,
  habitsTotal: 4,
  tasksDone: 0,
  tasksTotal: 0,
  studyMinutes: 0,
  wakeTime: "06:00",
  wakeEarly: true,
  logged: true,
});
assert.equal(half, 2, "on-time wake + half habits");

const loggedEmpty: HabitLogLike = {
  date: "2026-09-06",
  wakeTime: null,
  bedtime: null,
  checks: {},
};
const emptyLogged = buildConsistencyDay("2026-09-06", loggedEmpty, null, 0, keys);
assert.equal(emptyLogged.level, 1, "opened the day without checks is still a 1");
assert.equal(emptyLogged.logged, true);

const week = buildWeekConsistency({
  today: "2026-09-06",
  habitKeys: keys,
  logs: [
    {
      date: "2026-09-06",
      wakeTime: "05:52",
      bedtime: null,
      checks: { wakeEarly: true, gym: true, reading: true, noPhone: true },
    },
    {
      date: "2026-09-05",
      wakeTime: "07:10",
      bedtime: "23:00",
      checks: { wakeEarly: false, gym: true },
    },
  ],
  todos: [{ date: "2026-09-06", total: 3, done: 2 }],
  studyDays: [{ date: "2026-09-06", minutes: 30 }],
});
assert.equal(week.length, 7, "always seven days");
assert.equal(week[0].date, "2026-08-31");
assert.equal(week[6].date, "2026-09-06");
assert.equal(week[6].level, 4);
assert.equal(week[5].habitsDone, 2);
assert.equal(week[0].level, 0);

const tallied = tallyTodos([
  { date: "2026-09-06", done: true },
  { date: "2026-09-06", done: false },
  { date: "2026-09-05", done: true },
]);
assert.deepEqual(tallied, [
  { date: "2026-09-05", total: 1, done: 1 },
  { date: "2026-09-06", total: 2, done: 1 },
]);

console.log("consistency.test.ts ok");
