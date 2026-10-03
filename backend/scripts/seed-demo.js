// Seeds a fully-onboarded demo user: person + user, generated plan,
// workout logs for the last two weeks, water + sleep for the same window.
//
//   node scripts/seed-demo.js           -- skip if user "demo" exists
//   node scripts/seed-demo.js --reset   -- wipe and recreate
//
// Login after:  username "demo"  /  password "demo1234"

require("../src/config"); // load .env before anything else
const bcrypt = require("bcryptjs");
const pool = require("../src/db/mysql");
const { getMongo, closeMongo } = require("../src/db/mongo");
const { assignPlan } = require("../src/logic/assignPlan");
const { todayInTimezone, addDays } = require("../src/utils/dates");

const USERNAME = "demo";
const PASSWORD = "demo1234";
const TIMEZONE = "Europe/London";

const TEST_INPUTS = {
  birthDate: "1995-06-15",
  heightCm: 175,
  weightKg: 78,
  jobType: "Sedentary",
  weightTraining: "Moderate",
  cardioHistory: "Low",
  availabilityHoursPerDay: 1.5,
  healthIssueCount: 0,
  goalId: "G03", // Muscle
  gender: "male",
};

// Deterministic pseudo-random so re-runs produce the same seed data.
let rngState = 42;
function rng() {
  rngState = (rngState * 1664525 + 1013904223) >>> 0;
  return rngState / 0xffffffff;
}
function randInt(min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

async function wipeDemo() {
  const [rows] = await pool.query("SELECT id FROM users WHERE username = ?", [
    USERNAME,
  ]);
  if (rows.length === 0) return;
  const userId = rows[0].id;

  const [personRows] = await pool.query(
    "SELECT person_id FROM users WHERE id = ?",
    [userId],
  );
  const personId = personRows[0].person_id;

  console.log(`Wiping demo data (user ${userId}, person ${personId})...`);

  // Order matters: workout_logs -> workout_log_exercises (cascade),
  // user_plans, daily_logs. Then user, then person.
  await pool.query(`DELETE FROM workout_logs WHERE person_id = ?`, [personId]);
  await pool.query(`DELETE FROM user_plans WHERE person_id = ?`, [personId]);
  await pool.query(`DELETE FROM daily_logs WHERE person_id = ?`, [personId]);
  await pool.query(`DELETE FROM refresh_tokens WHERE user_id = ?`, [userId]);
  await pool.query(`DELETE FROM users WHERE id = ?`, [userId]);
  await pool.query(`DELETE FROM persons WHERE id = ?`, [personId]);

  // Also nuke any Mongo plan docs we wrote.
  const mongoDb = await getMongo();
  await mongoDb.collection("user_plans").deleteMany({ person_id: personId });
}

async function createPersonAndUser() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const [personResult] = await pool.query(
    `INSERT INTO persons (full_name, timezone) VALUES (?, ?)`,
    ["Demo User", TIMEZONE],
  );
  const personId = personResult.insertId;

  const [userResult] = await pool.query(
    `INSERT INTO users (username, password_hash, person_id) VALUES (?, ?, ?)`,
    [USERNAME, passwordHash, personId],
  );

  console.log(`Created user ${userResult.insertId}, person ${personId}`);
  return { userId: userResult.insertId, personId };
}

async function seedPlanAndLogs(personId) {
  // Run the real pipeline so the demo data matches production exactly.
  console.log("Generating plan...");
  const result = await assignPlan({ personId, inputs: TEST_INPUTS });
  console.log(`  plan "${result.plan.name}" (${result.plan.id})`);

  const [planRows] = await pool.query(
    `SELECT id, mongo_plan_id, started_at FROM user_plans
      WHERE person_id = ? AND status = 'active'`,
    [personId],
  );
  const userPlanId = planRows[0].id;
  const startedAt = planRows[0].started_at;

  const mongoDb = await getMongo();
  const planDoc = await mongoDb
    .collection("user_plans")
    .findOne({
      _id: require("mongodb").ObjectId.createFromHexString(
        planRows[0].mongo_plan_id,
      ),
    });

  const today = todayInTimezone(TIMEZONE);
  const daysSinceStart = Math.min(
    14,
    Math.round(
      (Date.parse(today) - Date.parse(String(startedAt).slice(0, 10))) /
        86400000,
    ),
  );

  console.log(`Seeding logs for the last ${daysSinceStart + 1} days...`);

  for (let i = daysSinceStart; i >= 0; i--) {
    const date = addDays(today, -i);
    const [y, m, d] = date.split("-").map(Number);
    const dayIndex =
      Math.floor(
        (Date.UTC(y, m - 1, d) -
          Date.UTC(
            ...String(startedAt)
              .slice(0, 10)
              .split("-")
              .map((x, idx) => (idx === 1 ? Number(x) - 1 : Number(x))),
          )) /
          86400000,
      ) % 7;

    const planDay = planDoc.days.find((dd) => dd.day === dayIndex + 1);
    if (!planDay) continue;

    // Water + sleep for every day.
    const water = randInt(1200, 2600);
    const sleep = Math.round((6 + rng() * 2.5) * 10) / 10;
    await pool.query(
      `INSERT INTO daily_logs (person_id, log_date, water_ml, sleep_hours)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE water_ml = VALUES(water_ml), sleep_hours = VALUES(sleep_hours)`,
      [personId, date, water, sleep],
    );

    // Skip rest days for workouts.
    if (planDay.is_rest) continue;

    const total = Object.values(planDay.exercises || {}).flat().length;
    if (total === 0) continue;

    // Bias toward complete, so the streak actually shows something.
    const done = Math.min(total, randInt(Math.floor(total * 0.6), total));

    const [logResult] = await pool.query(
      `INSERT INTO workout_logs
         (person_id, user_plan_id, log_date, day_number,
          exercises_done, exercises_total)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [personId, userPlanId, date, planDay.day, done, total],
    );
    const logId = logResult.insertId;

    const allExercises = Object.values(planDay.exercises).flat();
    const completed = allExercises.slice(0, done);
    if (completed.length > 0) {
      const values = completed.map(() => "(?, ?)").join(", ");
      const params = completed.flatMap((e) => [logId, e.exercise_id]);
      await pool.query(
        `INSERT INTO workout_log_exercises (workout_log_id, exercise_id)
         VALUES ${values}`,
        params,
      );
    }
  }
}

async function main() {
  const reset = process.argv.includes("--reset");
  const [existing] = await pool.query(
    "SELECT id FROM users WHERE username = ?",
    [USERNAME],
  );

  if (existing.length > 0) {
    if (!reset) {
      console.log(
        `User "${USERNAME}" already exists. Re-run with --reset to recreate.`,
      );
      return;
    }
    await wipeDemo();
  }

  const { personId } = await createPersonAndUser();
  await seedPlanAndLogs(personId);

  console.log("\nDone.");
  console.log(`  login:    ${USERNAME}`);
  console.log(`  password: ${PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
    await closeMongo().catch(() => {});
  });
