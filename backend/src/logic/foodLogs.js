const pool = require("../db/mysql");

async function getFoodLog(personId, date) {
  const [rows] = await pool.query(
    `SELECT calories, protein_g, carbs_g, fat_g, updated_at
       FROM food_logs
      WHERE person_id = ? AND log_date = ?`,
    [personId, date],
  );
  return rows[0] ?? null;
}

// Increment today's totals by the given amounts.
async function addFood({ personId, date, calories, proteinG, carbsG, fatG }) {
  await pool.query(
    `INSERT INTO food_logs (person_id, log_date, calories, protein_g, carbs_g, fat_g)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       calories  = calories  + VALUES(calories),
       protein_g = protein_g + VALUES(protein_g),
       carbs_g   = carbs_g   + VALUES(carbs_g),
       fat_g     = fat_g     + VALUES(fat_g)`,
    [personId, date, calories ?? 0, proteinG ?? 0, carbsG ?? 0, fatG ?? 0],
  );
  return getFoodLog(personId, date);
}

module.exports = { getFoodLog, addFood };
