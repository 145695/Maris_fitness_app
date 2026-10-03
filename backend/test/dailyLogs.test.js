const test = require("node:test");
const assert = require("node:assert/strict");
const { computeLoggingStreak } = require("../src/logic/dailyLogs");
const { dailyLogPatchSchema } = require("../src/utils/profileSchemas");

// ---------- dailyLogPatchSchema (B9) ----------------------------------------

const ok = (body) => dailyLogPatchSchema.safeParse(body).success;

test("dailyLogPatchSchema: accepts water only", () => {
  assert.equal(ok({ waterMl: 1500 }), true);
  assert.equal(ok({ waterMl: 0 }), true);
  assert.equal(ok({ waterMl: 10000 }), true);
});

test("dailyLogPatchSchema: accepts sleep only", () => {
  assert.equal(ok({ sleepHours: 7.5 }), true);
  assert.equal(ok({ sleepHours: 0 }), true);
  assert.equal(ok({ sleepHours: 24 }), true);
});

test("dailyLogPatchSchema: accepts both", () => {
  assert.equal(ok({ waterMl: 2000, sleepHours: 8 }), true);
});

test("dailyLogPatchSchema: accepts null to clear a field", () => {
  assert.equal(ok({ waterMl: null }), true);
  assert.equal(ok({ sleepHours: null }), true);
  assert.equal(ok({ waterMl: null, sleepHours: null }), true);
});

test("dailyLogPatchSchema: rejects empty body", () => {
  assert.equal(ok({}), false);
});

test("dailyLogPatchSchema: rejects out-of-range values", () => {
  assert.equal(ok({ waterMl: -1 }), false);
  assert.equal(ok({ waterMl: 10001 }), false);
  assert.equal(ok({ waterMl: 1.5 }), false);
  assert.equal(ok({ sleepHours: -0.1 }), false);
  assert.equal(ok({ sleepHours: 24.1 }), false);
});

test("dailyLogPatchSchema: rejects wrong types", () => {
  assert.equal(ok({ waterMl: "1500" }), false);
  assert.equal(ok({ sleepHours: "7.5" }), false);
  assert.equal(ok({ waterMl: true }), false);
});

// ---------- computeLoggingStreak (B10) --------------------------------------

const mkMap = (entries) =>
  new Map(
    entries.map(([date, waterMl, sleepHours]) => [
      date,
      { date, waterMl, sleepHours },
    ]),
  );

test("water: yesterday+2 before logged, today missing -> current=3", () => {
  const byDate = mkMap([
    ["2025-01-08", 1000, null],
    ["2025-01-09", 1000, null],
    ["2025-01-10", 1000, null],
  ]);
  const r = computeLoggingStreak(byDate, "2025-01-11", 5, "waterMl");
  assert.equal(r.currentStreak, 3);
  assert.equal(r.longestStreak, 3);
});

test("water: today not logged doesn't break current streak", () => {
  const byDate = mkMap([
    ["2025-01-09", 1000, null],
    ["2025-01-10", 1000, null],
  ]);
  const r = computeLoggingStreak(byDate, "2025-01-11", 3, "waterMl");
  assert.equal(r.currentStreak, 2);
});

test("water: a past gap breaks the current streak", () => {
  const byDate = mkMap([
    ["2025-01-06", 1000, null],
    // 01-07 missing (past -> break)
    ["2025-01-08", 1000, null],
    ["2025-01-09", 1000, null],
    ["2025-01-10", 1000, null],
  ]);
  const r = computeLoggingStreak(byDate, "2025-01-11", 6, "waterMl");
  assert.equal(r.currentStreak, 3);
  assert.equal(r.longestStreak, 3);
});

test("sleep streak is independent of water", () => {
  // Water: 01-07..01-09 logged, 01-10 missed, 01-11(today) logged -> current=1, longest=3
  // Sleep: 01-07..01-10 logged, 01-11(today) pending -> current=4, longest=4
  const byDate = mkMap([
    ["2025-01-07", 1000, 8],
    ["2025-01-08", 1000, 8],
    ["2025-01-09", 1000, 8],
    ["2025-01-10", null, 8], // water missed, sleep still going
    ["2025-01-11", 1000, null], // today: water logged, sleep pending
  ]);
  const water = computeLoggingStreak(byDate, "2025-01-11", 5, "waterMl");
  const sleep = computeLoggingStreak(byDate, "2025-01-11", 5, "sleepHours");

  assert.equal(water.currentStreak, 1);
  assert.equal(water.longestStreak, 3);

  assert.equal(sleep.currentStreak, 4);
  assert.equal(sleep.longestStreak, 4);
});

test("empty window -> zero streaks", () => {
  const r = computeLoggingStreak(new Map(), "2025-01-11", 5, "waterMl");
  assert.equal(r.currentStreak, 0);
  assert.equal(r.longestStreak, 0);
});
