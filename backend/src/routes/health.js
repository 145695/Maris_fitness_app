const { Router } = require("express");
const pool = require("../db/mysql");
const { getMongo } = require("../db/mongo");

const router = Router();

// Checks both databases separately so one being down does not hide the other.
router.get("/", async (req, res) => {
  const [mysqlCheck, mongoCheck] = await Promise.allSettled([
    pool.query("SELECT 1"),
    getMongo().then((db) => db.collection("plans").countDocuments()),
  ]);

  const mysqlOk = mysqlCheck.status === "fulfilled";
  const mongoOk = mongoCheck.status === "fulfilled";
  const ok = mysqlOk && mongoOk;

  res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "degraded",
    mysql: mysqlOk ? "ok" : "down",
    mongo: mongoOk ? "ok" : "down",
    ...(mongoOk ? { plans: mongoCheck.value } : {}),
  });
});

module.exports = router;
