import assert from "node:assert/strict";
import {
  missionCompactStat,
  missionDoing,
  missionProgress,
  type MissionPublic,
} from "./missions";

function stub(partial: Partial<MissionPublic> & Pick<MissionPublic, "progress">): MissionPublic {
  return {
    id: "m1",
    title: "Exam prep",
    kind: "manual",
    note: "",
    startDate: "2026-08-01",
    endDate: "2026-08-14",
    days: 14,
    active: !partial.progress.ended,
    habitKeys: [],
    taskTemplates: [],
    habitStats: [],
    checkDates: ["2026-08-01"],
    daysWorked: 1,
    doneToday: false,
    steps: [
      { id: "s1", text: "Notes", done: false, sortOrder: 0 },
      { id: "s2", text: "Mocks", done: false, sortOrder: 1 },
    ],
    ...partial,
  };
}

const ended = stub({
  active: false,
  progress: missionProgress("2026-08-01", "2026-08-20", 14),
});
assert.equal(ended.progress.ended, true);
assert.ok(missionDoing(ended, "2026-08-20").pct < 50, "show-up score stays low");
const endedStat = missionCompactStat(ended, "2026-08-20");
assert.equal(endedStat.finished, true);
assert.equal(endedStat.status, "Finished");
assert.ok(!endedStat.detail.includes("%"), "compact row has no percent");
assert.ok(endedStat.detail.includes("0/2 steps"));
assert.ok(endedStat.detail.includes("14 days"));

const live = stub({
  active: true,
  progress: missionProgress("2026-08-01", "2026-08-03", 14),
  steps: [
    { id: "s1", text: "Notes", done: true, sortOrder: 0 },
    { id: "s2", text: "Mocks", done: false, sortOrder: 1 },
  ],
});
const liveStat = missionCompactStat(live, "2026-08-03");
assert.equal(liveStat.finished, false);
assert.equal(liveStat.status, "Not finished");
assert.ok(liveStat.detail.includes("1/2 steps"));
assert.ok(liveStat.detail.includes("days left"));

const closedSteps = stub({
  active: true,
  progress: missionProgress("2026-08-01", "2026-08-03", 14),
  steps: [
    { id: "s1", text: "Notes", done: true, sortOrder: 0 },
    { id: "s2", text: "Mocks", done: true, sortOrder: 1 },
  ],
});
const closedStat = missionCompactStat(closedSteps, "2026-08-03");
assert.equal(closedStat.finished, true);
assert.equal(closedStat.status, "Finished");
assert.ok(closedStat.detail.includes("2/2 steps"));

console.log("missions-compact tests passed");
