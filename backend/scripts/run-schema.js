require("../src/config");
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

(async () => {
  console.log("Connecting to:");
  console.log("  host:", process.env.MYSQL_HOST);
  console.log("  port:", process.env.MYSQL_PORT);
  console.log("  user:", process.env.MYSQL_USER);
  console.log("  db:  ", process.env.MYSQL_DATABASE);

  const sql = fs.readFileSync(
    path.join(__dirname, "..", "database", "schema.sql"),
    "utf8",
  );

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    multipleStatements: true,
    ssl: { rejectUnauthorized: false },
    family: 4, // <-- forces IPv4, fixes ETIMEDOUT on Windows
    connectTimeout: 30000,
  });

  console.log("Connected. Running schema...");
  await conn.query(sql);
  console.log("Schema applied.");

  const [tables] = await conn.query("SHOW TABLES");
  console.log("Tables:", tables.map((r) => Object.values(r)[0]).join(", "));

  await conn.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
