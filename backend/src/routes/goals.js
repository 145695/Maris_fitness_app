// GET /goals -> the 11 selectable goals, seeded in the goals table.
// Reference data, so no auth required (onboarding needs it).
const { Router } = require("express");
const pool = require("../db/mysql");

const router = Router();

router.get("/", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, goal_type AS goalType, name FROM goals ORDER BY id",
  );
  res.json({ goals: rows });
});

module.exports = router;