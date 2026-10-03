// Orchestrates POST /me/test:
//   load person -> classify -> select template -> adjust -> store plan (Mongo)
//     -> write profile + plan pointer (MySQL, one transaction) -> return.
//
// Ordering is deliberate: the generated plan is written to Mongo FIRST so the
// MySQL row has a real mongo_plan_id to point at. If the MySQL transaction
// fails for any reason, the orphaned Mongo plan is deleted so it can never be
// referenced by a half-written profile.

const pool = require("../db/mysql");
const { getMongo } = require("../db/mongo");
const { classify } = require("./classify");
const { selectPlan } = require("./planSelector");
const { buildAdjustedPlan } = require("./adjustPlan");
const { calculateMacros } = require("./macros");
const { ageFromBirthDate } = require("../utils/age");
const { todayInTimezone, addDays } = require("../utils/dates");
const { badRequest, notFound, conflict } = require("../utils/errors");

// Generated plan documents live in this Mongo collection. Templates live in
// "plans", the exercise pool in "exercises".
const MONGO_PLAN_COLLECTION = "user_plans";

async function assignPlan({ personId, inputs }) {
  // ---- 1. Load the person + the goal they picked ------------------------
  const [personRows] = await pool.query(
    `SELECT p.id,
            p.timezone,
            p.category,
            g.id       AS goal_id,
            g.goal_type,
            g.name     AS goal_name
       FROM persons p
       LEFT JOIN goals g ON g.id = ?
      WHERE p.id = ?`,
    [inputs.goalId, personId],
  );
  const person = personRows[0];
  if (!person) throw notFound("Profile not found");
  if (!person.goal_id) {
    throw badRequest(`Unknown goalId "${inputs.goalId}"`, {
      goalId: inputs.goalId,
    });
  }
  if (person.category !== null) {
    throw conflict("Test already completed", "TEST_ALREADY_DONE");
  }

  // ---- 2. Classify (BMI -> bmi_group -> category) -----------------------
  const { bmi, bmiGroup, category } = classify({
    heightCm: inputs.heightCm,
    weightKg: inputs.weightKg,
    jobType: inputs.jobType,
    weightTraining: inputs.weightTraining,
    cardioHistory: inputs.cardioHistory,
  });

  // ---- 3. Age from the birth date in the request -----------------------
  // birth_date is NULL until the test, so we cannot use a stale DB value.
  const age = ageFromBirthDate(inputs.birthDate);
  if (age === null) {
    throw badRequest("Invalid birthDate", { birthDate: inputs.birthDate });
  }

  // ---- 4. Pick the template plan for (goalType, category) --------------
  const mongoDb = await getMongo();
  const template = await selectPlan(mongoDb, person.goal_type, category);

  // ---- 5. Build the adjusted plan (template + exercises) ---------------
  // seed = personId, so re-generating gives the same exercise picks.
  const adjusted = await buildAdjustedPlan(mongoDb, template, {
    age,
    availabilityHoursPerDay: inputs.availabilityHoursPerDay,
    healthIssueCount: inputs.healthIssueCount,
    category,
    seed: personId,
  });

  const startedAt = todayInTimezone(person.timezone);
  const endsAt =
    adjusted.duration_weeks != null
      ? addDays(startedAt, adjusted.duration_weeks * 7)
      : null;

  // ---- 6. Compute macros (stored with the plan) ------------------------
  // This must run BEFORE the Mongo insert so the doc carries the goals.
  const macros = calculateMacros({
    weightKg: inputs.weightKg,
    heightCm: inputs.heightCm,
    age,
    gender: inputs.gender,
    daysPerWeek: adjusted.adjusted_days_per_week,
    goalType: person.goal_type,
  });

  // ---- 7. Persist the generated plan in Mongo (first) ------------------
  const planDoc = {
    person_id: personId,
    template_plan_id: template._id,
    goal_id: person.goal_id,
    goal_type: person.goal_type,
    category,
    generated_at: new Date(),
    started_at: startedAt,
    ends_at: endsAt,
    macros, // <-- stored so GET /me/food can return goals
    ...adjusted,
  };
  const insert = await mongoDb
    .collection(MONGO_PLAN_COLLECTION)
    .insertOne(planDoc);
  const mongoPlanId = insert.insertedId.toString();

  // ---- 8. MySQL writes, all-or-nothing ---------------------------------
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // The generated columns (bmi, bmi_group, category) populate themselves.
    await conn.query(
      `UPDATE persons
          SET birth_date                 = ?,
              height_cm                  = ?,
              weight_kg                  = ?,
              job_type                   = ?,
              weight_training            = ?,
              cardio_history             = ?,
              availability_hours_per_day = ?,
              health_issue_count         = ?,
              goal_id                    = ?
        WHERE id = ?`,
      [
        inputs.birthDate,
        inputs.heightCm,
        inputs.weightKg,
        inputs.jobType,
        inputs.weightTraining,
        inputs.cardioHistory,
        inputs.availabilityHoursPerDay,
        inputs.healthIssueCount,
        inputs.goalId,
        personId,
      ],
    );

    await conn.query(
      `INSERT INTO user_plans
         (person_id, template_plan_id, mongo_plan_id, goal_id, category,
          age_at_start, height_cm, weight_kg,
          availability_hours_per_day, health_issue_count,
          started_at, ends_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        personId,
        template._id,
        mongoPlanId,
        person.goal_id,
        category,
        age,
        inputs.heightCm,
        inputs.weightKg,
        inputs.availabilityHoursPerDay,
        inputs.healthIssueCount,
        startedAt,
        endsAt,
      ],
    );

    await conn.commit();
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rollbackErr) {
      console.error("Rollback failed:", rollbackErr);
    }

    // Orphan cleanup: the plan in Mongo must never outlive a failed write.
    try {
      await mongoDb
        .collection(MONGO_PLAN_COLLECTION)
        .deleteOne({ _id: insert.insertedId });
    } catch (cleanupErr) {
      console.error(
        `Orphaned plan ${mongoPlanId} could not be deleted:`,
        cleanupErr,
      );
    }

    // A concurrent request for the same person wins the unique-active race;
    // surface it as 409 rather than a raw 500.
    if (err && err.code === "ER_DUP_ENTRY") {
      throw conflict(
        "A plan is already active for this account",
        "PLAN_EXISTS",
      );
    }
    throw err;
  } finally {
    conn.release();
  }

  // ---- 9. Return the plan + macros -------------------------------------
  return {
    plan: {
      id: mongoPlanId,
      templateId: template._id,
      name: adjusted.plan_name,
      startedAt,
      endsAt,
      durationWeeks: adjusted.duration_weeks,
      daysPerWeek: adjusted.adjusted_days_per_week,
      extraRestDaysApplied: adjusted.extra_rest_days_applied,
      sessionMinutes: adjusted.session_minutes,
      exercisesPerType: adjusted.exercises_per_type,
      days: adjusted.days,
    },
    macros,
    classification: { bmi, bmiGroup, category },
  };
}

module.exports = { assignPlan };
