const test = require("node:test");
const assert = require("node:assert/strict");
const {
  flattenDayExercises,
  isWorkoutComplete,
} = require("../src/logic/workoutLogs");

// --- flattenDayExercises ----------------------------------------------------

test("flattenDayExercises: empty and undefined -> []", () => {
  assert.deepEqual(flattenDayExercises({}), []);
  assert.deepEqual(flattenDayExercises(undefined), []);
  assert.deepEqual(flattenDayExercises(null), []);
});

test("flattenDayExercises: one type, preserves order", () => {
  const out = flattenDayExercises({
    "Upper Body": [
      { exercise_id: "a", name: "A" },
      { exercise_id: "b", name: "B" },
    ],
  });
  assert.deepEqual(
    out.map((e) => e.exercise_id),
    ["a", "b"],
  );
});

test("flattenDayExercises: multiple types, concatenates all", () => {
  const out = flattenDayExercises({
    "Upper Body": [{ exercise_id: "a" }],
    Cardio: [{ exercise_id: "c" }],
  });
  assert.deepEqual(out.map((e) => e.exercise_id).sort(), ["a", "c"]);
});

test("flattenDayExercises: ignores non-array entries", () => {
  const out = flattenDayExercises({
    "Upper Body": [{ exercise_id: "a" }],
    Broken: null,
    AlsoBroken: "not an array",
  });
  assert.deepEqual(
    out.map((e) => e.exercise_id),
    ["a"],
  );
});

// --- isWorkoutComplete ------------------------------------------------------
// Threshold is 0.5 by default (config.workout.completionThreshold).

test("isWorkoutComplete: 0 of 0 -> false (rest day)", () => {
  assert.equal(isWorkoutComplete(0, 0), false);
});

test("isWorkoutComplete: below threshold -> false", () => {
  assert.equal(isWorkoutComplete(0, 10), false);
  assert.equal(isWorkoutComplete(4, 10), false);
  assert.equal(isWorkoutComplete(1, 5), false);
});

test("isWorkoutComplete: exactly at threshold -> true", () => {
  assert.equal(isWorkoutComplete(5, 10), true);
  assert.equal(isWorkoutComplete(1, 2), true);
});

test("isWorkoutComplete: above threshold -> true", () => {
  assert.equal(isWorkoutComplete(9, 10), true);
  assert.equal(isWorkoutComplete(10, 10), true);
});

test("isWorkoutComplete: guards against bad totals", () => {
  assert.equal(isWorkoutComplete(5, -1), false);
  assert.equal(isWorkoutComplete(5, NaN), false);
  assert.equal(isWorkoutComplete(5, Infinity), false);
});
