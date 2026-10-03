// Workout log read/write helpers.
// One workout_logs row per (person, date); one workout_log_exercises row per
// checked-off exercise. A "completed" day is derived, never stored.

const pool = require("../db/mysql");
const {
  workout: { completionThreshold },
} = require("../config");

/**
 * A day's exercises are stored per type: { "Upper Body": [...], "Core": [...] }.
 * The log layer doesn't care which type an exercise came from, so flatten.
 */
function flattenDayExercises(exercisesByType) {
  const out = [];
  for (const list of Object.values(exercisesByType || {})) {
    if (Array.isArray(list)) out.push(...list);
  }
  return out;
}

/**
 * Is a workout day "completed"?
 *   - rest day (0 exercises planned) -> never "completed"
 *   - otherwise -> done / total >= completionThreshold (default 0.5)
 */
function isWorkoutComplete(exercisesDone, exercisesTotal) {
  if (!Number.isFinite(exercisesTotal) || exercisesTotal <= 0) return false;
  return exercisesDone / exercisesTotal >= completionThreshold;
}

/**
 * Insert-or-replace a workout log and its exercise list in one transaction.
 * Returns { id, updated_at }.
 */
async function upsertWorkoutLog({
  personId,
  userPlanId,
  date,
  dayNumber,
  exercisesDone,
  exercisesTotal,
  exerciseIds,
}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO workout_logs
         (person_id, user_plan_id, log_date, day_number,
          exercises_done, exercises_total)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         user_plan_id    = VALUES(user_plan_id),
         day_number      = VALUES(day_number),
         exercises_done  = VALUES(exercises_done),
         exercises_total = VALUES(exercises_total)`,
      [personId, userPlanId, date, dayNumber, exercisesDone, exercisesTotal],
    );

    const [rows] = await conn.query(
      `SELECT id, updated_at
         FROM workout_logs
        WHERE person_id = ? AND log_date = ?`,
      [personId, date],
    );
    const logId = rows[0].id;

    // Replace the checked-off set — PUT means "this is now the whole set".
    await conn.query(
      `DELETE FROM workout_log_exercises WHERE workout_log_id = ?`,
      [logId],
    );

    if (exerciseIds.length > 0) {
      const placeholders = exerciseIds.map(() => "(?, ?)").join(", ");
      const flat = exerciseIds.flatMap((id) => [logId, id]);
      await conn.query(
        `INSERT INTO workout_log_exercises (workout_log_id, exercise_id)
         VALUES ${placeholders}`,
        flat,
      );
    }

    await conn.commit();
    return rows[0];
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rollbackErr) {
      console.error("Rollback failed:", rollbackErr);
    }
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  flattenDayExercises,
  isWorkoutComplete,
  upsertWorkoutLog,
};
