const test = require("node:test");
const assert = require("node:assert/strict");
const {
  extraRestDaysForAge,
  applyAgeRestDays,
  adjustSessionMinutes,
  exerciseCountForSession,
  pickExercisesForType,
  prescriptionFor,
  validatePlanInputs,
} = require("../src/logic/adjustPlan");
const { AppError } = require("../src/utils/errors");

// --- small pieces -----------------------------------------------------------

test("extraRestDaysForAge brackets", () => {
  assert.equal(extraRestDaysForAge(25), 0);
  assert.equal(extraRestDaysForAge(35), 1);
  assert.equal(extraRestDaysForAge(45), 2);
  assert.equal(extraRestDaysForAge(55), 3);
  assert.equal(extraRestDaysForAge(70), 3);
});

test("applyAgeRestDays converts the last N training days", () => {
  const days = [
    { day: "Mon", is_rest: false, types: ["Upper"] },
    { day: "Tue", is_rest: false, types: ["Lower"] },
    { day: "Wed", is_rest: false, types: ["Back"] },
    { day: "Thu", is_rest: false, types: ["Upper"] },
  ];
  const out = applyAgeRestDays(days, 40); // 40 -> extraRest 2
  assert.equal(out.extraRestDaysApplied, 2);
  assert.equal(out.daysPerWeek, 2);
  assert.equal(out.days[2].is_rest, true);
  assert.equal(out.days[3].is_rest, true);
  assert.equal(out.days[0].is_rest, false);
});

test("adjustSessionMinutes caps by availability and reduces per health issue", () => {
  const plan = { session_minutes: { max: 90 } };
  assert.equal(adjustSessionMinutes(plan, 2, 0), 90); // availability not binding
  assert.equal(adjustSessionMinutes(plan, 1, 0), 60); // 60 min available
  assert.equal(adjustSessionMinutes(plan, 2, 1), 45); // 90 - 45
  assert.equal(adjustSessionMinutes(plan, 1, 2), 15); // clamped to MIN
});

test("exerciseCountForSession threshold", () => {
  assert.equal(exerciseCountForSession(89), 4);
  assert.equal(exerciseCountForSession(90), 5);
});

test("prescriptionFor branches on weighted equipment", () => {
  assert.equal(
    prescriptionFor({ reps: 10, equipment: "Barbell" }),
    "Use the heaviest weight you can manage for 10 reps.",
  );
  assert.equal(
    prescriptionFor({ reps: 10, equipment: "Bodyweight" }),
    "10 reps, bodyweight.",
  );
  assert.equal(prescriptionFor({ duration: 30 }), 30);
});

// --- pickExercisesForType ---------------------------------------------------

function fakeDb(docs) {
  return {
    collection: () => ({
      find: () => ({
        project: () => ({
          toArray: async () => docs.map((d) => ({ ...d })),
        }),
      }),
    }),
  };
}

test("pickExercisesForType keeps exercise_id from _id", async () => {
  const docs = [
    {
      _id: 42,
      name: "Row",
      difficulty: "Normal",
      equipment: "barbell",
      reps: 8,
    },
  ];
  const out = await pickExercisesForType(fakeDb(docs), "Back", "Normal", 5);
  assert.equal(out.length, 1);
  assert.equal(out[0].exercise_id, "42");
  assert.equal(out[0]._id, undefined);
});

test("unknown difficulty sorts last", async () => {
  const docs = [
    {
      _id: 1,
      name: "A",
      difficulty: "Easy",
      equipment: "bodyweight",
      reps: 10,
    },
    { _id: 2, name: "B", difficulty: "Extreme", equipment: "barbell", reps: 5 },
    {
      _id: 3,
      name: "C",
      difficulty: "Unknown",
      equipment: "bodyweight",
      reps: 8,
    },
    { _id: 4, name: "D", difficulty: "Hard", equipment: "barbell", reps: 6 },
  ];
  // Muscular preference: Extreme, Hard, Normal, Easy -> Unknown falls after Easy.
  const out = await pickExercisesForType(
    fakeDb(docs),
    "Strength",
    "Muscular",
    10,
  );
  assert.deepEqual(
    out.map((e) => e.exercise_id),
    ["2", "4", "1", "3"],
  );
});

test("seeded shuffle is deterministic and only reorders within a tier", async () => {
  const docs = [
    {
      _id: 1,
      name: "Hard1",
      difficulty: "Hard",
      equipment: "barbell",
      reps: 5,
    },
    {
      _id: 2,
      name: "Hard2",
      difficulty: "Hard",
      equipment: "barbell",
      reps: 5,
    },
    {
      _id: 3,
      name: "Hard3",
      difficulty: "Hard",
      equipment: "barbell",
      reps: 5,
    },
    {
      _id: 4,
      name: "Easy1",
      difficulty: "Easy",
      equipment: "bodyweight",
      reps: 10,
    },
    {
      _id: 5,
      name: "Easy2",
      difficulty: "Easy",
      equipment: "bodyweight",
      reps: 10,
    },
  ];

  const a = await pickExercisesForType(fakeDb(docs), "Strength", "Normal", 5, {
    seed: "user-1",
  });
  const b = await pickExercisesForType(fakeDb(docs), "Strength", "Normal", 5, {
    seed: "user-1",
  });
  assert.deepEqual(
    a.map((e) => e.exercise_id),
    b.map((e) => e.exercise_id),
  );

  // Hard always comes before Easy regardless of shuffle.
  const hardCount = a.filter((e) => e.difficulty === "Hard").length;
  assert.equal(
    a.slice(0, hardCount).every((e) => e.difficulty === "Hard"),
    true,
  );
});

// --- validatePlanInputs -----------------------------------------------------

test("validatePlanInputs accepts a good payload", () => {
  assert.doesNotThrow(() =>
    validatePlanInputs({
      age: 30,
      availabilityHoursPerDay: 1.5,
      healthIssueCount: 0,
      category: "Normal",
    }),
  );
});

test("validatePlanInputs throws AppError(400) on each bad field", () => {
  const good = {
    age: 30,
    availabilityHoursPerDay: 1.5,
    healthIssueCount: 0,
    category: "Normal",
  };
  const isBadRequest = (e) => e instanceof AppError && e.status === 400;

  assert.throws(() => validatePlanInputs({ ...good, age: -1 }), isBadRequest);
  assert.throws(() => validatePlanInputs({ ...good, age: 3.5 }), isBadRequest);
  assert.throws(
    () => validatePlanInputs({ ...good, availabilityHoursPerDay: 0 }),
    isBadRequest,
  );
  assert.throws(
    () => validatePlanInputs({ ...good, availabilityHoursPerDay: 25 }),
    isBadRequest,
  );
  assert.throws(
    () => validatePlanInputs({ ...good, healthIssueCount: -1 }),
    isBadRequest,
  );
  assert.throws(
    () => validatePlanInputs({ ...good, healthIssueCount: 1.5 }),
    isBadRequest,
  );
  assert.throws(
    () => validatePlanInputs({ ...good, category: "Nope" }),
    isBadRequest,
  );
});
