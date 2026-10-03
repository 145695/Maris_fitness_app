// backend/scripts/setup-db.js
//
// Creates the MySQL database + tables and loads the MongoDB plans + exercises.
//   npm run setup-db             -> creates whatever is missing, never deletes user data
//   npm run setup-db -- --reset  -> DROPS the MySQL database and rebuilds it (deletes all users/persons!)
//
// Needs in backend/database/: schema.sql, plans.json, exercises.json
// Needs in backend/.env: MYSQL_* and MONGO_* values (see .env example)

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");
const { MongoClient } = require("mongodb");

const RESET = process.argv.includes("--reset");
const DB_DIR = path.join(__dirname, "..", "database");

function findFile(name) {
  const dirs = [DB_DIR, path.join(DB_DIR, "mysql"), path.join(DB_DIR, "mongo")];
  for (const d of dirs) {
    const p = path.join(d, name);
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`Cannot find ${name} - put it in backend/database/`);
}

async function setupMySQL() {
  const dbName = process.env.MYSQL_DATABASE || "fitness_app";
  if (dbName !== "fitness_app") {
    throw new Error(
      "schema.sql creates a database called fitness_app - set MYSQL_DATABASE=fitness_app in .env",
    );
  }

  // connect WITHOUT choosing a database, because it may not exist yet
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    multipleStatements: true,
  });

  try {
    const [found] = await conn.query(
      "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
      [dbName],
    );

    if (found.length && !RESET) {
      console.log(
        `MySQL: database "${dbName}" already exists - left untouched (use --reset to rebuild it).`,
      );
      return;
    }
    if (found.length && RESET) {
      console.log(`MySQL: --reset given, dropping "${dbName}"...`);
      await conn.query(`DROP DATABASE \`${dbName}\``);
    }

    await conn.query(fs.readFileSync(findFile("schema.sql"), "utf8"));

    const [[{ n }]] = await conn.query(
      `SELECT COUNT(*) AS n FROM \`${dbName}\`.goals`,
    );
    const [tables] = await conn.query(
      "SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME",
      [dbName],
    );
    console.log(
      `MySQL: created "${dbName}" -> tables/views: ${tables.map((r) => r.t).join(", ")} (${n} goals loaded)`,
    );
  } finally {
    await conn.end();
  }
}

async function setupMongo() {
  const client = new MongoClient(
    process.env.MONGO_URI || "mongodb://localhost:27017",
    {
      serverSelectionTimeoutMS: 5000,
    },
  );
  await client.connect();
  try {
    const db = client.db(process.env.MONGO_DB || "fitness_app");

    // plans + exercises are reference data: reloaded from the JSON files each run
    for (const [collection, file] of [
      ["plans", "plans.json"],
      ["exercises", "exercises.json"],
    ]) {
      const docs = JSON.parse(fs.readFileSync(findFile(file), "utf8"));
      await db.collection(collection).deleteMany({});
      await db.collection(collection).insertMany(docs);
      console.log(`MongoDB: ${collection} -> ${docs.length} documents loaded`);
    }

    await db
      .collection("plans")
      .createIndex({ goal_type: 1, category: 1 }, { unique: true });
    await db.collection("exercises").createIndex({ types: 1 });
    await db.collection("exercises").createIndex({ types: 1, equipment: 1 });
    await db.collection("exercises").createIndex({ types: 1, muscle_group: 1 });
    await db.collection("exercises").createIndex({ name: 1 });
    console.log("MongoDB: indexes created");
  } finally {
    await client.close();
  }
}

function explain(label, e) {
  console.error(`\n${label} FAILED: ${e.message}`);
  if (e.code === "ECONNREFUSED" || e.name === "MongoServerSelectionError") {
    console.error(
      `  -> ${label} is not running (or the host/port in .env is wrong). Start the server first.`,
    );
  }
  if (e.code === "ER_ACCESS_DENIED_ERROR") {
    console.error("  -> Wrong MYSQL_USER / MYSQL_PASSWORD in backend/.env");
  }
}

(async () => {
  let failed = false;
  try {
    await setupMySQL();
  } catch (e) {
    explain("MySQL", e);
    failed = true;
  }
  try {
    await setupMongo();
  } catch (e) {
    explain("MongoDB", e);
    failed = true;
  }
  console.log(
    failed
      ? "\nSetup finished WITH ERRORS."
      : "\nAll done. Now run: npm run dev",
  );
  process.exit(failed ? 1 : 0);
})();
