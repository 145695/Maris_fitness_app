// Look up a person's active plan. Side effect: if the plan has passed its
// ends_at, mark it 'completed' and return null.
//
// The mark is idempotent — a plan row can only transition 'active' ->
// 'completed' once, and concurrent calls that both read 'active' will both
// attempt the same UPDATE, which is a no-op the second time.

const pool = require("../db/mysql");
const { todayInTimezone } = require("../utils/dates");

async function getActivePlan(personId, timezone) {
  const today = todayInTimezone(timezone);

  const [rows] = await pool.query(
    `SELECT id, mongo_plan_id, template_plan_id, goal_id, category,
            started_at, ends_at, status, created_at
       FROM user_plans
      WHERE person_id = ? AND status = 'active'
      LIMIT 1`,
    [personId],
  );
  const row = rows[0];
  if (!row) return null;

  // ends_at is EXCLUSIVE per the schema, so the plan is over on that date.
  if (row.ends_at && row.ends_at <= today) {
    await pool.query(
      "UPDATE user_plans SET status = 'completed' WHERE id = ?",
      [row.id],
    );
    return null;
  }

  return row;
}

module.exports = { getActivePlan };
