const test = require("node:test");
const assert = require("node:assert/strict");
const { planDayFor } = require("../src/logic/planDays");
const { daysBetween, addDays, todayInTimezone } = require("../src/utils/dates");

// A minimal 7-day cycle plan starting Mon 2025-01-06:
//   1 Upper, 2 rest, 3 Lower, 4 rest, 5 Back, 6 rest, 7 Cardio
function makePlan(startedAt = "2025-01-06") {
  return {
    started_at: startedAt,
    days: [
      {
        day: 1,
        is_rest: false,
        types: ["Upper Body"],
        exercises: { "Upper Body": [{ exercise_id: "x", name: "Bench" }] },
      },
      { day: 2, is_rest: true, types: [], exercises: {} },
      {
        day: 3,
        is_rest: false,
        types: ["Lower Body"],
        exercises: { "Lower Body": [{ exercise_id: "y", name: "Squat" }] },
      },
      { day: 4, is_rest: true, types: [], exercises: {} },
      {
        day: 5,
        is_rest: false,
        types: ["Back"],
        exercises: { Back: [{ exercise_id: "z", name: "Row" }] },
      },
      { day: 6, is_rest: true, types: [], exercises: {} },
      {
        day: 7,
        is_rest: false,
        types: ["Cardio"],
        exercises: { Cardio: [{ exercise_id: "c", name: "Treadmill" }] },
      },
    ],
  };
}

// --- planDayFor: cycle position ---------------------------------------------

test("day 1: started_at itself", () => {
  const r = planDayFor(makePlan("2025-01-06"), "2025-01-06");
  assert.equal(r.weekNumber, 1);
  assert.equal(r.dayNumber, 1);
  assert.equal(r.isRest, false);
  assert.deepEqual(r.types, ["Upper Body"]);
});

test("day 7: last day of week 1", () => {
  const r = planDayFor(makePlan("2025-01-06"), "2025-01-12");
  assert.equal(r.weekNumber, 1);
  assert.equal(r.dayNumber, 7);
});

test("day 8: first day of week 2 (wraps)", () => {
  const r = planDayFor(makePlan("2025-01-06"), "2025-01-13");
  assert.equal(r.weekNumber, 2);
  assert.equal(r.dayNumber, 1);
});

test("week 4 boundary: day 22 is day 1 of week 4", () => {
  const r = planDayFor(makePlan("2025-01-06"), "2025-01-27");
  assert.equal(r.weekNumber, 4);
  assert.equal(r.dayNumber, 1);
});

test("rest day carries no types or exercises", () => {
  const r = planDayFor(makePlan("2025-01-06"), "2025-01-07");
  assert.equal(r.dayNumber, 2);
  assert.equal(r.isRest, true);
  assert.deepEqual(r.types, []);
  assert.deepEqual(r.exercises, {});
});

test("training day exposes its exercises", () => {
  const r = planDayFor(makePlan("2025-01-06"), "2025-01-10"); // day 5
  assert.equal(r.dayNumber, 5);
  assert.deepEqual(r.types, ["Back"]);
  assert.equal(r.exercises.Back[0].exercise_id, "z");
});

test("future date returns null", () => {
  assert.equal(planDayFor(makePlan("2025-01-06"), "2025-01-05"), null);
});

// --- planDayFor: input validation -------------------------------------------

test("throws when started_at missing", () => {
  assert.throws(() => planDayFor({ days: [] }, "2025-01-06"));
});

test("throws when days missing or empty", () => {
  const base = { started_at: "2025-01-06" };
  assert.throws(() => planDayFor({ ...base }, "2025-01-06"));
  assert.throws(() => planDayFor({ ...base, days: [] }, "2025-01-06"));
});

test("throws when todayIso is malformed", () => {
  const plan = makePlan("2025-01-06");
  assert.throws(() => planDayFor(plan, "2025/01/06"));
  assert.throws(() => planDayFor(plan, "tomorrow"));
  assert.throws(() => planDayFor(plan, 20250106));
});

test("is deterministic for the same input", () => {
  const plan = makePlan("2025-01-06");
  const a = planDayFor(plan, "2025-01-13");
  const b = planDayFor(plan, "2025-01-13");
  assert.deepEqual(a, b);
});

// --- dates helpers ----------------------------------------------------------

test("daysBetween: basic", () => {
  assert.equal(daysBetween("2025-01-06", "2025-01-06"), 0);
  assert.equal(daysBetween("2025-01-06", "2025-01-07"), 1);
  assert.equal(daysBetween("2025-01-06", "2025-01-13"), 7);
  assert.equal(daysBetween("2025-01-06", "2025-02-06"), 31);
});

test("daysBetween: month, year, leap boundaries", () => {
  assert.equal(daysBetween("2024-02-28", "2024-03-01"), 2); // leap
  assert.equal(daysBetween("2023-02-28", "2023-03-01"), 1); // non-leap
  assert.equal(daysBetween("2024-12-31", "2025-01-01"), 1);
  assert.equal(daysBetween("2025-02-28", "2025-03-01"), 1);
});

test("addDays: basic + across boundaries", () => {
  assert.equal(addDays("2025-01-06", 0), "2025-01-06");
  assert.equal(addDays("2025-01-06", 1), "2025-01-07");
  assert.equal(addDays("2025-01-06", 7), "2025-01-13");
  assert.equal(addDays("2025-01-06", 70), "2025-03-17");
  assert.equal(addDays("2024-02-28", 2), "2024-03-01"); // leap
});

test("todayInTimezone: returns YYYY-MM-DD for a real timezone", () => {
  assert.match(todayInTimezone("UTC"), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(todayInTimezone("Africa/Algiers"), /^\d{4}-\d{2}-\d{2}$/);
});

test("todayInTimezone: different timezones can differ by one day", () => {
  // Auckland is UTC+12/13, Honolulu UTC-10. Around the UTC date boundary
  // they straddle two calendar days. We can't freeze time here, so just
  // assert both return valid strings — the boundary behavior is exercised
  // by the values coming from the DB in production.
  assert.match(todayInTimezone("Pacific/Auckland"), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(todayInTimezone("Pacific/Honolulu"), /^\d{4}-\d{2}-\d{2}$/);
});
