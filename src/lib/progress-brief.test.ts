import assert from "node:assert/strict";
import { buildProgressReport } from "./progress-brief";

const base = {
  range: "today" as const,
  habitPct: 80,
  taskPct: 50,
  fullHabitDays: 1,
  allTaskDays: 0,
  loggedDays: 1,
  windowDays: 1,
  wakeOnTimeDays: 1,
  wakeLoggedDays: 1,
  nightDays: 0,
  sleepAvg: null,
  weakestWeekday: null,
  strongestWeekday: null,
  weakestHabit: null,
  studyMinutes: null,
  studyLabel: null,
  prevHabitPct: null,
  prevTaskPct: null,
  leftoverHigh: [] as string[],
};

const named = buildProgressReport({
  ...base,
  closedTasks: ["Ship landing", "Review PRs", "Gym", "Call", "Write"],
  todayTaskTotal: 6,
});
const closedLine = named.happened.find((l) => l.startsWith("Tasks closed:"));
assert.ok(closedLine, "today report names closed tasks");
assert.ok(closedLine?.includes("Ship landing"));
assert.ok(
  closedLine?.includes("of the list today"),
  "today copy mentions the list"
);

const empty = buildProgressReport({
  ...base,
  taskPct: 0,
  closedTasks: [],
  todayTaskTotal: 3,
});
assert.ok(
  empty.happened.some((l) => l.includes("none closed yet of 3")),
  "today report says when the list is still open"
);

const past = buildProgressReport({
  ...base,
  isToday: false,
  loggedDays: 0,
  wakeLoggedDays: 0,
  fullHabitDays: 0,
  habitPct: 0,
});
assert.ok(
  past.headline.includes("nothing logged"),
  "past day with no data is not phrased as today"
);

console.log("progress-brief tests passed");
