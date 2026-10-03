// /me - the logged-in user's profile. Everything here sits behind requireAuth,
// so req.user = { id, username, personId } is always set. All failures are
// AppError -> the standard error shape.
const { Router } = require("express");
const { ObjectId } = require("mongodb");
const rateLimit = require("express-rate-limit");

const pool = require("../db/mysql");
const { getMongo } = require("../db/mongo");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { badRequest, notFound, conflict } = require("../utils/errors");
const { addDays, todayInTimezone } = require("../utils/dates");

const {
  avatarPatchSchema,
  submitTestSchema,
  workoutDateParams,
  workoutPutSchema,
  dailyLogPatchSchema,
  dailyDateParams,
  dailyRecentQuerySchema,
  streakQuerySchema,
} = require("../utils/profileSchemas");

const {
  getDailyLog,
  upsertDailyLog,
  getDailyLogsInRange,
  computeLoggingStreak,
} = require("../logic/dailyLogs");

const { assignPlan } = require("../logic/assignPlan");
const { getActivePlan } = require("../logic/getActivePlan");
const { planDayFor } = require("../logic/planDays");
const {
  flattenDayExercises,
  isWorkoutComplete,
  upsertWorkoutLog,
} = require("../logic/workoutLogs");
const {
  computeDayStatuses,
  computeCurrentStreak,
  computeLongestStreak,
} = require("../logic/streaks");

const router = Router();

// Every route in this file requires a valid access token.
router.use(requireAuth);

const { ipKeyGenerator } = require("express-rate-limit");

const writeLimit = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyGenerator: (req) =>
    req.user?.id
      ? `u:${req.user.id}`
      : `ip:${ipKeyGenerator(req.ip)}`,
  standardHeaders: true,
  legacyHeaders: false,
});

// --- helpers -----------------------------------------------------------

const ME_SELECT = `
  SELECT u.id          AS user_id,
         u.username,
         p.id          AS person_id,
         p.full_name,
         p.birth_date,
         p.height_cm,
         p.weight_kg,
         p.job_type,
         p.weight_training,
         p.cardio_history,
         p.availability_hours_per_day,
         p.health_issue_count,
         p.bmi,
         p.bmi_group,
         p.category,
         p.goal_id,
         g.name        AS goal_name,
         p.avatar_shape,
         p.avatar_color,
         p.timezone
    FROM users u
    JOIN persons p ON p.id = u.person_id
    LEFT JOIN goals g ON g.id = p.goal_id
   WHERE u.id = ?`;

async function loadMe(userId) {
  const [rows] = await pool.query(ME_SELECT, [userId]);
  return rows[0];
}

function formatMe(row) {
  return {
    user: { id: row.user_id, username: row.username },
    person: {
      id: row.person_id,
      fullName: row.full_name,
      birthDate: row.birth_date,
      heightCm: row.height_cm,
      weightKg: row.weight_kg,
      jobType: row.job_type,
      weightTraining: row.weight_training,
      cardioHistory: row.cardio_history,
      availabilityHoursPerDay: row.availability_hours_per_day,
      healthIssueCount: row.health_issue_count,
      bmi: row.bmi,
      bmiGroup: row.bmi_group,
      category: row.category,
      goal: row.goal_id ? { id: row.goal_id, name: row.goal_name } : null,
      avatarShape: row.avatar_shape,
      avatarColor: row.avatar_color,
      timezone: row.timezone,
    },
    testDone: row.category !== null,
  };
}

// Load the active plan + its Mongo doc, or fail with the right AppError.
// Returns { me, active, planDoc }.
async function loadActivePlanForUser(userId, personId) {
  const me = await loadMe(userId);
  if (!me) throw notFound("Profile not found");

  const active = await getActivePlan(personId, me.timezone);
  if (!active) throw conflict("No active plan", "NO_ACTIVE_PLAN");

  const mongoDb = await getMongo();
  const planDoc = await mongoDb.collection("user_plans").findOne({
    _id: new ObjectId(active.mongo_plan_id),
  });
  if (!planDoc) throw notFound("Plan not found");

  return { me, active, planDoc };
}

// --- profile -----------------------------------------------------------

// GET /me -> user + full person profile + testDone flag + today's water/sleep.
router.get("/", async (req, res) => {
  const row = await loadMe(req.user.id);
  if (!row) throw notFound("Profile not found");

  const today = todayInTimezone(row.timezone);
  const daily = await getDailyLog(req.user.personId, today);

  res.json({
    ...formatMe(row),
    today: {
      date: today,
      waterMl: daily?.water_ml ?? null,
      sleepHours: daily?.sleep_hours ?? null,
    },
  });
});

// PATCH /me/avatar -> update one or both avatar fields, return the result.
router.patch(
  "/avatar",
  writeLimit,
  validate({ body: avatarPatchSchema }),
  async (req, res) => {
    const { avatarShape, avatarColor } = req.validated.body;

    const sets = [];
    const values = [];
    if (avatarShape !== undefined) {
      sets.push("avatar_shape = ?");
      values.push(avatarShape);
    }
    if (avatarColor !== undefined) {
      sets.push("avatar_color = ?");
      values.push(avatarColor);
    }

    const [result] = await pool.query(
      `UPDATE persons SET ${sets.join(", ")} WHERE id = ?`,
      [...values, req.user.personId],
    );
    if (result.affectedRows === 0) throw notFound("Profile not found");

    const [rows] = await pool.query(
      "SELECT avatar_shape, avatar_color FROM persons WHERE id = ?",
      [req.user.personId],
    );
    res.json({
      avatarShape: rows[0].avatar_shape,
      avatarColor: rows[0].avatar_color,
    });
  },
);

// --- test + plan -------------------------------------------------------

// POST /me/test -> first (and only) time the profile test inputs are written,
// and the plan is generated + assigned. 409 if already taken.
router.post(
  "/test",
  writeLimit,
  validate({ body: submitTestSchema }),
  async (req, res) => {
    const result = await assignPlan({
      personId: req.user.personId,
      inputs: req.validated.body,
    });

    // Reload the profile the same way GET /me does, so the client can update
    // its cached "me" object from this one response.
    const row = await loadMe(req.user.id);
    if (!row) throw notFound("Profile not found");

    res.status(201).json({
      ...formatMe(row),
      plan: result.plan,
      macros: result.macros,
    });
  },
);

// GET /me/plan -> the person's active plan + today's slice.
// needs_test=true means the client should push the user into the test flow.
router.get("/plan", async (req, res) => {
  const me = await loadMe(req.user.id);
  if (!me) throw notFound("Profile not found");

  // Never took the test -> nothing to retrieve.
  if (me.category === null) {
    return res.json({ needs_test: true, reason: "never_taken" });
  }

  const active = await getActivePlan(req.user.personId, me.timezone);

  // Had a plan, plan is over (or was reaped just now).
  if (!active) {
    return res.json({ needs_test: true, reason: "plan_ended" });
  }

  const mongoDb = await getMongo();
  const planDoc = await mongoDb.collection("user_plans").findOne({
    _id: new ObjectId(active.mongo_plan_id),
  });

  // MySQL points at a doc that no longer exists. Treat as needing a new
  // test rather than 500-ing — the client recovers by re-onboarding.
  if (!planDoc) {
    return res.json({ needs_test: true, reason: "plan_missing" });
  }

  const today = todayInTimezone(me.timezone);
  const todayData = planDayFor(planDoc, today);

  res.json({
    needs_test: false,
    plan: {
      id: planDoc._id.toString(),
      name: planDoc.plan_name,
      templateId: planDoc.template_plan_id,
      goalId: planDoc.goal_id,
      goalType: planDoc.goal_type,
      category: planDoc.category,
      generatedAt: planDoc.generated_at,
      startedAt: active.started_at,
      endsAt: active.ends_at, // null = lifelong
      durationWeeks: planDoc.duration_weeks,
      originalDaysPerWeek: planDoc.original_days_per_week,
      extraRestDaysApplied: planDoc.extra_rest_days_applied,
      adjustedDaysPerWeek: planDoc.adjusted_days_per_week,
      sessionMinutes: planDoc.session_minutes,
      exercisesPerType: planDoc.exercises_per_type,
      days: planDoc.days,
    },
    today: todayData, // null if today is before the plan starts (shouldn't happen)
  });
});

// --- daily water + sleep -----------------------------------------------

// GET /me/daily -> today's water + sleep.
router.get("/daily", async (req, res) => {
  const me = await loadMe(req.user.id);
  if (!me) throw notFound("Profile not found");

  const today = todayInTimezone(me.timezone);
  const log = await getDailyLog(req.user.personId, today);

  res.json({
    date: today,
    waterMl: log?.water_ml ?? null,
    sleepHours: log?.sleep_hours ?? null,
    updatedAt: log?.updated_at ?? null,
  });
});

// PATCH /me/daily -> partial update of today's row.
// Sending only `waterMl` leaves `sleepHours` untouched, and vice versa.
// Explicit `null` clears a field.
router.patch(
  "/daily",
  writeLimit,
  validate({ body: dailyLogPatchSchema }),
  async (req, res) => {
    const me = await loadMe(req.user.id);
    if (!me) throw notFound("Profile not found");

    const today = todayInTimezone(me.timezone);
    const { waterMl, sleepHours } = req.validated.body;

    const log = await upsertDailyLog({
      personId: req.user.personId,
      date: today,
      waterMl,
      sleepHours,
    });

    res.json({
      date: today,
      waterMl: log.water_ml,
      sleepHours: log.sleep_hours,
      updatedAt: log.updated_at,
    });
  },
);

// GET /me/daily/recent?days=30
// Day-by-day water/sleep for the last N days, plus summary stats.
// Registered BEFORE /daily/:date so "recent" isn't parsed as a date.
router.get(
  "/daily/recent",
  validate({ query: dailyRecentQuerySchema }),
  async (req, res) => {
    const me = await loadMe(req.user.id);
    if (!me) throw notFound("Profile not found");

    const days = req.validated.query.days;
    const today = todayInTimezone(me.timezone);
    const from = addDays(today, -(days - 1));

    const entries = await getDailyLogsInRange(req.user.personId, from, today);
    const byDate = new Map(entries.map((e) => [e.date, e]));

    // Full window including days with no log.
    const window = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = addDays(today, -i);
      const entry = byDate.get(date);
      window.push({
        date,
        waterMl: entry?.waterMl ?? null,
        sleepHours: entry?.sleepHours ?? null,
      });
    }

    const waterValues = window.map((d) => d.waterMl).filter((v) => v != null);
    const sleepValues = window
      .map((d) => d.sleepHours)
      .filter((v) => v != null);

    res.json({
      window: { days, from, to: today },
      days: window,
      summary: {
        daysLogged: window.filter(
          (d) => d.waterMl != null || d.sleepHours != null,
        ).length,
        water: {
          daysLogged: waterValues.length,
          totalMl: waterValues.reduce((a, b) => a + b, 0),
          averageMl: waterValues.length
            ? Math.round(
                waterValues.reduce((a, b) => a + b, 0) / waterValues.length,
              )
            : null,
          ...computeLoggingStreak(byDate, today, days, "waterMl"),
        },
        sleep: {
          daysLogged: sleepValues.length,
          averageHours: sleepValues.length
            ? Math.round(
                (sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length) *
                  10,
              ) / 10
            : null,
          ...computeLoggingStreak(byDate, today, days, "sleepHours"),
        },
      },
    });
  },
);

// GET /me/daily/:date -> any past date's water + sleep.
router.get(
  "/daily/:date",
  validate({ params: dailyDateParams }),
  async (req, res) => {
    const me = await loadMe(req.user.id);
    if (!me) throw notFound("Profile not found");

    const { date } = req.validated.params;
    const today = todayInTimezone(me.timezone);
    if (date > today) {
      throw badRequest("Cannot read a future date", { date, today });
    }

    const log = await getDailyLog(req.user.personId, date);
    res.json({
      date,
      waterMl: log?.water_ml ?? null,
      sleepHours: log?.sleep_hours ?? null,
      updatedAt: log?.updated_at ?? null,
    });
  },
);

// PATCH /me/daily/:date -> partial update of any past date.
router.patch(
  "/daily/:date",
  writeLimit,
  validate({ params: dailyDateParams, body: dailyLogPatchSchema }),
  async (req, res) => {
    const me = await loadMe(req.user.id);
    if (!me) throw notFound("Profile not found");

    const { date } = req.validated.params;
    const today = todayInTimezone(me.timezone);
    if (date > today) {
      throw badRequest("Cannot log a future date", { date, today });
    }

    const { waterMl, sleepHours } = req.validated.body;
    const log = await upsertDailyLog({
      personId: req.user.personId,
      date,
      waterMl,
      sleepHours,
    });

    res.json({
      date,
      waterMl: log.water_ml,
      sleepHours: log.sleep_hours,
      updatedAt: log.updated_at,
    });
  },
);

// --- workouts ----------------------------------------------------------

// PUT /me/workouts/:date
// Body: { completedExerciseIds: [...] } — the FULL set of checked exercises.
// PUT, not PATCH, because the semantics are "this is the complete state".
router.put(
  "/workouts/:date",
  writeLimit,
  validate({ params: workoutDateParams, body: workoutPutSchema }),
  async (req, res) => {
    const { date } = req.validated.params;
    const { completedExerciseIds } = req.validated.body;

    const { me, active, planDoc } = await loadActivePlanForUser(
      req.user.id,
      req.user.personId,
    );

    const today = todayInTimezone(me.timezone);
    if (date > today) {
      throw badRequest("Cannot log a future workout", { date, today });
    }
    if (date < active.started_at) {
      throw badRequest("Date is before the plan started", {
        date,
        startedAt: active.started_at,
      });
    }
    if (active.ends_at && date >= active.ends_at) {
      throw badRequest("Date is outside the plan window", {
        date,
        endsAt: active.ends_at,
      });
    }

    const day = planDayFor(planDoc, date);
    if (!day) throw badRequest("No plan day for this date", { date });
    if (day.isRest) {
      throw badRequest("Cannot log a workout on a rest day", { date });
    }

    const plannedExercises = flattenDayExercises(day.exercises);
    const validIds = new Set(plannedExercises.map((e) => e.exercise_id));

    // Dedupe + validate against the plan.
    const seen = new Set();
    const uniqueIds = [];
    for (const id of completedExerciseIds) {
      if (!validIds.has(id)) {
        throw badRequest(`Exercise "${id}" is not part of this day's plan`, {
          exerciseId: id,
        });
      }
      if (!seen.has(id)) {
        seen.add(id);
        uniqueIds.push(id);
      }
    }

    const exercisesTotal = plannedExercises.length;
    const exercisesDone = uniqueIds.length;

    const log = await upsertWorkoutLog({
      personId: req.user.personId,
      userPlanId: active.id,
      date,
      dayNumber: day.dayNumber,
      exercisesDone,
      exercisesTotal,
      exerciseIds: uniqueIds,
    });

    res.json({
      date,
      dayNumber: day.dayNumber,
      weekNumber: day.weekNumber,
      isRest: false,
      types: day.types,
      exercises: day.exercises,
      log: {
        exercisesDone,
        exercisesTotal,
        completedExerciseIds: uniqueIds,
        completed: isWorkoutComplete(exercisesDone, exercisesTotal),
        updatedAt: log.updated_at,
      },
    });
  },
);

// GET /me/workouts/:date
// Always returns the plan's slice for that day; includes `log` when the user
// has recorded anything for it, otherwise log: null.
router.get(
  "/workouts/:date",
  validate({ params: workoutDateParams }),
  async (req, res) => {
    const { date } = req.validated.params;

    const { active, planDoc } = await loadActivePlanForUser(
      req.user.id,
      req.user.personId,
    );

    if (date < active.started_at) {
      throw badRequest("Date is before the plan started", {
        date,
        startedAt: active.started_at,
      });
    }
    if (active.ends_at && date >= active.ends_at) {
      throw badRequest("Date is outside the plan window", {
        date,
        endsAt: active.ends_at,
      });
    }

    const day = planDayFor(planDoc, date);

    const [logRows] = await pool.query(
      `SELECT wl.id, wl.exercises_done, wl.exercises_total, wl.updated_at,
              wle.exercise_id
         FROM workout_logs wl
         LEFT JOIN workout_log_exercises wle
           ON wle.workout_log_id = wl.id
        WHERE wl.person_id = ? AND wl.log_date = ?
        ORDER BY wle.exercise_id`,
      [req.user.personId, date],
    );

    let log = null;
    if (logRows.length > 0) {
      const head = logRows[0];
      const completedExerciseIds = logRows
        .map((r) => r.exercise_id)
        .filter(Boolean);
      log = {
        exercisesDone: head.exercises_done,
        exercisesTotal: head.exercises_total,
        completedExerciseIds,
        completed: isWorkoutComplete(head.exercises_done, head.exercises_total),
        updatedAt: head.updated_at,
      };
    }

    res.json({
      date,
      dayNumber: day?.dayNumber ?? null,
      weekNumber: day?.weekNumber ?? null,
      isRest: day?.isRest ?? true,
      types: day?.types ?? [],
      exercises: day?.exercises ?? {},
      log,
    });
  },
);

// --- streaks -----------------------------------------------------------

// GET /me/streak?days=7
// Returns per-day completion statuses for the last N days plus streak counts.
// `days` defaults to 7 (week view) and maxes at 90 (~3 months).
// `out_of_plan` days are trimmed so the client only renders real days.
router.get(
  "/streak",
  validate({ query: streakQuerySchema }),
  async (req, res) => {
    const me = await loadMe(req.user.id);
    if (!me) throw notFound("Profile not found");

    const days = req.validated.query.days;
    const today = todayInTimezone(me.timezone);
    const from = addDays(today, -(days - 1));

    const active = await getActivePlan(req.user.personId, me.timezone);
    if (!active) {
      return res.json({
        window: { days, from, to: today },
        currentStreak: 0,
        longestStreak: 0,
        days: [],
      });
    }

    const mongoDb = await getMongo();
    const planDoc = await mongoDb.collection("user_plans").findOne({
      _id: new ObjectId(active.mongo_plan_id),
    });
    if (!planDoc) throw notFound("Plan not found");

    const [logRows] = await pool.query(
      `SELECT log_date, exercises_done, exercises_total
         FROM workout_logs
        WHERE person_id = ? AND log_date BETWEEN ? AND ?`,
      [req.user.personId, from, today],
    );
    const logsByDate = new Map(logRows.map((r) => [String(r.log_date), r]));

    const statuses = computeDayStatuses(planDoc, logsByDate, today, days);
    const trimmed = statuses.filter((d) => d.status !== "out_of_plan");

    res.json({
      window: { days, from, to: today },
      currentStreak: computeCurrentStreak(trimmed),
      longestStreak: computeLongestStreak(trimmed),
      days: trimmed,
    });
  },
);

module.exports = router;
