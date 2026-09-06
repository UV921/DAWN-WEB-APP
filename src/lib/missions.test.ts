import assert from "node:assert/strict";
import {
  formatDaysRemain,
  formatMissionMissed,
  missionDoing,
  missionStatusLabel,
  type MissionPublic,
} from "./missions";

function sample(over: Partial<MissionPublic> = {}): MissionPublic {
  return {
    id: "m1",
    title: "Hackathon",
    kind: "manual",
    note: "Ship the landing",
    focus: "Finish the demo",
    startDate: "2026-09-01",
    endDate: "2026-09-07",
    days: 7,
    active: true,
    habitKeys: [],
    taskTemplates: [],
    progress: {
      active: true,
      day: 6,
      total: 7,
      daysLeft: 2,
      ended: false,
      ongoing: false,
    },
    habitStats: [],
    checkDates: ["2026-09-01", "2026-09-02", "2026-09-03"],
    daysWorked: 3,
    doneToday: false,
    steps: [
      { id: "s1", text: "Build API", done: true, sortOrder: 0 },
      { id: "s2", text: "Write pitch", done: false, sortOrder: 1 },
      { id: "s3", text: "Record demo", done: false, sortOrder: 2 },
    ],
    ...over,
  };
}

assert.equal(formatDaysRemain(sample().progress), "2 days remain");
assert.equal(
  formatDaysRemain({ ...sample().progress, daysLeft: 1 }),
  "Last day"
);
assert.equal(
  formatDaysRemain({
    active: true,
    day: 4,
    total: 0,
    daysLeft: 0,
    ended: false,
    ongoing: true,
  }),
  "Ongoing"
);
assert.equal(
  formatDaysRemain({
    active: false,
    day: 7,
    total: 7,
    daysLeft: 0,
    ended: true,
    ongoing: false,
  }),
  "Finished"
);

assert.equal(missionStatusLabel(sample()), "Ongoing");
assert.equal(
  missionStatusLabel(sample({ active: false })),
  "Already done"
);
assert.equal(
  missionStatusLabel(
    sample({
      progress: {
        active: false,
        day: 7,
        total: 7,
        daysLeft: 0,
        ended: true,
        ongoing: false,
      },
    })
  ),
  "Already done"
);

assert.equal(
  formatMissionMissed(sample()),
  "You have not done Write pitch and Record demo."
);
assert.equal(
  formatMissionMissed(
    sample({
      steps: [{ id: "s1", text: "Build API", done: false, sortOrder: 0 }],
    })
  ),
  "You have not done Build API."
);
assert.equal(
  formatMissionMissed(
    sample({
      steps: [
        { id: "s1", text: "A", done: true, sortOrder: 0 },
        { id: "s2", text: "B", done: true, sortOrder: 1 },
      ],
    })
  ),
  "Every step is done."
);
assert.equal(formatMissionMissed(sample({ steps: [] })), "No steps left open.");

const doing = missionDoing(sample(), "2026-09-06");
assert.equal(doing.stepsDone, 1);
assert.equal(doing.stepsTotal, 3);
assert.equal(doing.workedDays, 3);
assert.ok(doing.pct >= 0 && doing.pct <= 100, "score is a percentage");

console.log("missions.test.ts ok");
