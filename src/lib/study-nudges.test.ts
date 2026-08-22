import assert from "node:assert/strict";
import {
  clampStudyNudgeMinutes,
  formatStudyNudgeInterval,
  intervalInputFromMinutes,
  isStudyNudgeDue,
  minutesFromIntervalInput,
  studyNudgeBrowserSlot,
  studyNudgeDueAt,
} from "./study-nudges";

const start = new Date("2026-08-22T10:00:00.000Z");

assert.equal(clampStudyNudgeMinutes(20), 20);
assert.equal(clampStudyNudgeMinutes(0), 1);
assert.equal(clampStudyNudgeMinutes(9999), 720);
assert.equal(minutesFromIntervalInput(1, "hr"), 60);
assert.equal(minutesFromIntervalInput(90, "min"), 90);
assert.deepEqual(intervalInputFromMinutes(60), { amount: 1, unit: "hr" });
assert.deepEqual(intervalInputFromMinutes(20), { amount: 20, unit: "min" });
assert.equal(formatStudyNudgeInterval(20), "20m");
assert.equal(formatStudyNudgeInterval(60), "1h");
assert.equal(formatStudyNudgeInterval(90), "1h 30m");

const firstDue = studyNudgeDueAt(start, null, 20);
assert.equal(firstDue.toISOString(), "2026-08-22T10:20:00.000Z");

assert.equal(
  isStudyNudgeDue({
    now: new Date("2026-08-22T10:19:59.000Z"),
    sessionStartedAt: start,
    lastFiredAt: null,
    intervalMinutes: 20,
  }),
  false
);
assert.equal(
  isStudyNudgeDue({
    now: new Date("2026-08-22T10:20:00.000Z"),
    sessionStartedAt: start,
    lastFiredAt: null,
    intervalMinutes: 20,
  }),
  true
);

const fired = new Date("2026-08-22T10:20:00.000Z");
assert.equal(
  isStudyNudgeDue({
    now: new Date("2026-08-22T10:39:00.000Z"),
    sessionStartedAt: start,
    lastFiredAt: fired,
    intervalMinutes: 20,
  }),
  false
);
assert.equal(
  isStudyNudgeDue({
    now: new Date("2026-08-22T10:40:00.000Z"),
    sessionStartedAt: start,
    lastFiredAt: fired,
    intervalMinutes: 20,
  }),
  true
);

const oldFire = new Date("2026-08-22T08:00:00.000Z");
assert.equal(
  studyNudgeDueAt(start, oldFire, 20).toISOString(),
  "2026-08-22T10:20:00.000Z",
  "a fire from a previous session does not delay this one"
);

assert.equal(studyNudgeBrowserSlot(start, new Date("2026-08-22T10:19:00.000Z"), 20), 0);
assert.equal(studyNudgeBrowserSlot(start, new Date("2026-08-22T10:20:00.000Z"), 20), 1);
assert.equal(studyNudgeBrowserSlot(start, new Date("2026-08-22T10:45:00.000Z"), 20), 2);

console.log("study-nudges tests passed");
