// Daily water + sleep. One row per (person, date) — the DB enforces that.
// Values are absolute (last write wins), and per the schema comment only
// *today* is writable, checked in the user's timezone by the route.
//
// Field semantics:
//   undefined  -> leave the column unchanged
//   null       -> clear the column
//   value      -> set the column

const pool = require("../db/mysql");

async function getDailyLog(personId, date) {
  const [rows] = await pool.query(
    `SELECT water_ml, sleep_hours, updated_at
       FROM daily_logs
      WHERE person_id = ? AND log_date = ?`,
    [personId, date],
  );
  return rows[0] ?? null;
}

async function upsertDailyLog({ personId, date, waterMl, sleepHours }) {
  const insertCols = ["person_id", "log_date"];
  const insertVals = [personId, date];
  const updateSets = [];
  const updateVals = [];

  if (waterMl !== undefined) {
    insertCols.push("water_ml");
    insertVals.push(waterMl);
    updateSets.push("water_ml = ?");
    updateVals.push(waterMl);
  }
  if (sleepHours !== undefined) {
    insertCols.push("sleep_hours");
    insertVals.push(sleepHours);
    updateSets.push("sleep_hours = ?");
    updateVals.push(sleepHours);
  }

  // The route's Zod schema guarantees at least one field, so this branch
  // is defensive only.
  if (updateSets.length === 0) {
    return getDailyLog(personId, date);
  }

  const placeholders = insertCols.map(() => "?").join(", ");
  await pool.query(
    `INSERT INTO daily_logs (${insertCols.join(", ")})
     VALUES (${placeholders})
     ON DUPLICATE KEY UPDATE ${updateSets.join(", ")}`,
    [...insertVals, ...updateVals],
  );

  return getDailyLog(personId, date);
}
const { addDays } = require("../utils/dates");

// Fetch every daily log in [from, to], oldest first.
async function getDailyLogsInRange(personId, from, to) {
  const [rows] = await pool.query(
    `SELECT log_date, water_ml, sleep_hours, updated_at
       FROM daily_logs
      WHERE person_id = ? AND log_date BETWEEN ? AND ?
      ORDER BY log_date`,
    [personId, from, to],
  );
  return rows.map((r) => ({
    date: String(r.log_date),
    waterMl: r.water_ml,
    sleepHours: r.sleep_hours,
    updatedAt: r.updated_at,
  }));
}

// Consecutive days where `field` ("waterMl" or "sleepHours") is non-null.
// Same pending-vs-missed rule as workout streaks: today not yet logged does
// NOT break the current streak; any *past* day missing the value does.
function computeLoggingStreak(entriesByDate, todayIso, days, field) {
  // Build oldest -> newest.
  const window = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(todayIso, -i);
    const entry = entriesByDate.get(date);
    window.push({
      date,
      logged: entry != null && entry[field] != null,
      isToday: date === todayIso,
    });
  }

  let longestStreak = 0;
  let run = 0;
  for (const d of window) {
    if (d.logged) {
      run++;
      if (run > longestStreak) longestStreak = run;
    } else {
      run = 0;
    }
  }

  let currentStreak = 0;
  for (let i = window.length - 1; i >= 0; i--) {
    const d = window[i];
    if (d.logged) currentStreak++;
    else if (d.isToday)
      continue; // pending, doesn't break
    else break;
  }

  return { currentStreak, longestStreak };
}

module.exports = {
  getDailyLog,
  upsertDailyLog,
  getDailyLogsInRange,
  computeLoggingStreak,
};

