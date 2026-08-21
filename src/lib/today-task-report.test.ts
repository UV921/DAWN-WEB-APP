import assert from "node:assert/strict";
import {
  closedTaskLine,
  closedTaskNames,
  groupTasksByList,
  splitTodayTasks,
} from "./today-task-report";

const todos = [
  { text: "Ship landing", done: true, title: "Today", parentId: null },
  { text: "Review PRs", done: true, title: "Today", parentId: null },
  { text: "Buy milk", done: false, title: "Buy", parentId: null, priority: "high" },
  { text: "Nested note", done: true, title: "Today", parentId: "abc" },
  { text: "Write report", done: false, title: "Today", parentId: null, priority: "low" },
];

const split = splitTodayTasks(todos);
assert.equal(split.total, 4, "subtasks are not counted as roots");
assert.equal(split.doneCount, 2);
assert.equal(split.pct, 50);
assert.deepEqual(
  split.done.map((t) => t.text),
  ["Ship landing", "Review PRs"]
);
assert.deepEqual(
  split.open.map((t) => t.text),
  ["Buy milk", "Write report"],
  "open tasks sort high priority first"
);

const groups = groupTasksByList(split.done);
assert.equal(groups.length, 1);
assert.equal(groups[0].title, "Today");

const mixed = groupTasksByList([...split.done, split.open[0]]);
assert.equal(mixed.length, 2);
assert.ok(mixed.some((g) => g.title === "Buy"));

assert.deepEqual(closedTaskNames(split.done), ["Ship landing", "Review PRs"]);
assert.equal(closedTaskLine(split.done), "Ship landing, Review PRs");
assert.equal(
  closedTaskLine(
    [
      { text: "A", done: true },
      { text: "B", done: true },
      { text: "C", done: true },
      { text: "D", done: true },
      { text: "E", done: true },
    ],
    3
  ),
  "A, B, C (+2 more)"
);
assert.equal(closedTaskLine([]), null);

const empty = splitTodayTasks([]);
assert.equal(empty.pct, 0);
assert.equal(empty.total, 0);

console.log("today-task-report tests passed");
