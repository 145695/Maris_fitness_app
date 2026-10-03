// Drops the fitness_app database and rebuilds it from database/schema.sql.
// Reads Aiven credentials from .env.
//
//   node scripts/reset-mysql.js
//
// WARNING: destroys all existing data in fitness_app.

require("dotenv").config({ quiet: true });
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const DB_NAME = process.env.MYSQL_DATABASE || "fitness_app";

(async () => {
  const schema = fs.readFileSync(
    path.join(__dirname, "..", "database", "schema.sql"),
    "utf8",
  );

  // Connect WITHOUT specifying a database, so we can drop/create it.
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    multipleStatements: true,
    ssl: { rejectUnauthorized: false },
  });

  console.log(`Dropping database ${DB_NAME} if it exists...`);
  await conn.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);

  console.log(`Creating database ${DB_NAME}...`);
  await conn.query(
    `CREATE DATABASE \`${DB_NAME}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );

  console.log("Switching to it and running schema...");
  await conn.query(`USE \`${DB_NAME}\``);
  await conn.query(schema);

  const [dbs] = await conn.query("SHOW DATABASES");
  console.log("Databases:", dbs.map((r) => Object.values(r)[0]).join(", "));

  const [tables] = await conn.query(`SHOW TABLES FROM \`${DB_NAME}\``);
  console.log("Tables:", tables.map((r) => Object.values(r)[0]).join(", "));

  await conn.end();
  console.log("Done.");
})().catch((err) => {
  console.error("Reset failed:", err.message);
  process.exit(1);
});
