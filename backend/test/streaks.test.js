const test = require("node:test");
const assert = require("node:assert/strict");
const {
  computeDayStatuses,
  computeCurrentStreak,
  computeLongestStreak,
} = require("../src/logic/streaks");

// 7-day plan starting 2025-01-06 (Mon). Days 1, 3, 5, 7 training; 2, 4, 6 rest.
// Each training day has 2 exercises (so 1 of 2 = 50% = complete).
function makePlan(startedAt = "2025-01-06") {
  return {
    started_at: startedAt,
    days: [
      {
        day: 1,
        is_rest: false,
        types: ["Upper"],
        exercises: { Upper: [{ exercise_id: "a" }, { exercise_id: "b" }] },
      },
      { day: 2, is_rest: true, types: [], exercises: {} },
      {
        day: 3,
        is_rest: false,
        types: ["Lower"],
        exercises: { Lower: [{ exercise_id: "c" }, { exercise_id: "d" }] },
      },
      { day: 4, is_rest: true, types: [], exercises: {} },
      {
        day: 5,
        is_rest: false,
        types: ["Back"],
        exercises: { Back: [{ exercise_id: "e" }, { exercise_id: "f" }] },
      },
      { day: 6, is_rest: true, types: [], exercises: {} },
      {
        day: 7,
        is_rest: false,
        types: ["Core"],
        exercises: { Core: [{ exercise_id: "g" }, { exercise_id: "h" }] },
      },
    ],
  };
}

// Shorthand: log with done/total
const log = (done, total) => ({ exercises_done: done, exercises_total: total });
const map = (entries) => new Map(entries);

// --- computeDayStatuses -----------------------------------------------------

test("statuses: no logs, first day of plan", () => {
  const plan = makePlan("2025-01-06");
  const s = computeDayStatuses(plan, map([]), "2025-01-06", 1);
  assert.equal(s[0].date, "2025-01-06");
  assert.equal(s[0].dayNumber, 1);
  assert.equal(s[0].status, "pending"); // today, not yet completed
});

test("statuses: yesterday completed, today is rest", () => {
  const plan = makePlan("2025-01-05");
  const logs = map([["2025-01-05", log(2, 2)]]); // day 1 completed
  const s = computeDayStatuses(plan, logs, "2025-01-06", 2);
  assert.equal(s[0].status, "completed"); // 2025-01-05 = day 1, training
  assert.equal(s[1].status, "rest"); // 2025-01-06 = day 2, rest
});

test("statuses: rest day gets status 'rest'", () => {
  const plan = makePlan("2025-01-05");
  const s = computeDayStatuses(plan, map([]), "2025-01-06", 2);
  assert.equal(s[1].dayNumber, 2);
  assert.equal(s[1].isRest, true);
  assert.equal(s[1].status, "rest");
});

test("statuses: past training day without completion is 'missed'", () => {
  const plan = makePlan("2025-01-04");
  // day 1 completed, day 2 rest, day 3 (today's yesterday) not logged
  const logs = map([["2025-01-04", log(2, 2)]]);
  const s = computeDayStatuses(plan, logs, "2025-01-06", 3);
  assert.equal(s[0].status, "completed"); // 2025-01-04
  assert.equal(s[1].status, "rest"); // 2025-01-05
  assert.equal(s[2].status, "pending"); // 2025-01-06 = day 3, today
});

test("statuses: partial log below threshold is missed", () => {
  const plan = makePlan("2025-01-04");
  const logs = map([["2025-01-05", log(0, 2)]]); // day 2 rest, but log exists — ignored
  const s = computeDayStatuses(plan, logs, "2025-01-07", 4);
  // 2025-01-04 day 1 training, no log → missed
  // 2025-01-05 day 2 rest
  // 2025-01-06 day 3 training, no log → missed
  // 2025-01-07 day 4 rest
  assert.equal(s[0].status, "missed");
  assert.equal(s[1].status, "rest");
  assert.equal(s[2].status, "missed");
  assert.equal(s[3].status, "rest");
});

test("statuses: outside plan window is 'out_of_plan'", () => {
  const plan = makePlan("2025-01-06");
  const s = computeDayStatuses(plan, map([]), "2025-01-08", 5);
  // window: 2025-01-04 .. 2025-01-08
  //   01-04: before started_at        -> out_of_plan
  //   01-05: before started_at        -> out_of_plan
  //   01-06: day 1, training, no log  -> missed
  //   01-07: day 2, rest              -> rest
  //   01-08: day 3, training, today   -> pending
  assert.equal(s[0].status, "out_of_plan");
  assert.equal(s[1].status, "out_of_plan");
  assert.equal(s[2].status, "missed");
  assert.equal(s[3].status, "rest");
  assert.equal(s[4].status, "pending");
});

// --- computeCurrentStreak ---------------------------------------------------

test("currentStreak: today completed, yesterday rest, day-before completed", () => {
  const statuses = [
    { status: "completed" },
    { status: "rest" },
    { status: "completed" },
  ];
  assert.equal(computeCurrentStreak(statuses), 2);
});

test("currentStreak: today pending does not break", () => {
  const statuses = [
    { status: "completed" },
    { status: "completed" },
    { status: "pending" },
  ];
  assert.equal(computeCurrentStreak(statuses), 2);
});

test("currentStreak: missed yesterday stops the walk", () => {
  const statuses = [
    { status: "completed" },
    { status: "missed" },
    { status: "pending" },
  ];
  assert.equal(computeCurrentStreak(statuses), 0);
});

test("currentStreak: today rest does not break", () => {
  const statuses = [
    { status: "completed" },
    { status: "completed" },
    { status: "rest" },
  ];
  assert.equal(computeCurrentStreak(statuses), 2);
});

test("currentStreak: out_of_plan does not break", () => {
  const statuses = [
    { status: "out_of_plan" },
    { status: "completed" },
    { status: "completed" },
  ];
  assert.equal(computeCurrentStreak(statuses), 2);
});

// --- computeLongestStreak ---------------------------------------------------

test("longestStreak: rest days are transparent", () => {
  const statuses = [
    { status: "completed" },
    { status: "rest" },
    { status: "completed" },
    { status: "completed" },
  ];
  assert.equal(computeLongestStreak(statuses), 3);
});

test("longestStreak: broken by missed", () => {
  const statuses = [
    { status: "completed" },
    { status: "completed" },
    { status: "missed" },
    { status: "completed" },
  ];
  assert.equal(computeLongestStreak(statuses), 2);
});

test("longestStreak: empty", () => {
  assert.equal(computeLongestStreak([]), 0);
});

test("longestStreak: all rest", () => {
  const statuses = [{ status: "rest" }, { status: "rest" }];
  assert.equal(computeLongestStreak(statuses), 0);
});

// --- integration-ish -------------------------------------------------------

test("full week: mixed days", () => {
  // Plan starts 2025-01-06. Today = 2025-01-12 (day 7).
  // Days: 1(Mon)=completed, 2=rest, 3=completed, 4=rest, 5=completed, 6=rest, 7(today)=pending
  const plan = makePlan("2025-01-06");
  const logs = map([
    ["2025-01-06", log(2, 2)],
    ["2025-01-08", log(1, 2)], // exactly 50% → complete
    ["2025-01-10", log(2, 2)],
  ]);
  const s = computeDayStatuses(plan, logs, "2025-01-12", 7);
  assert.deepEqual(
    s.map((d) => d.status),
    ["completed", "rest", "completed", "rest", "completed", "rest", "pending"],
  );
  assert.equal(computeCurrentStreak(s), 3);
  assert.equal(computeLongestStreak(s), 3);
});
