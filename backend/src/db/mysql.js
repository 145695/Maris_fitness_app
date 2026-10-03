const mysql = require("mysql2/promise");
const config = require("../config");

module.exports = mysql.createPool({
  host: config.mysql.host,
  port: config.mysql.port,
  user: config.mysql.user,
  password: config.mysql.password,
  database: config.mysql.database,
  waitForConnections: true,
  connectionLimit: config.mysql.connectionLimit,
  // Return DATE columns as "YYYY-MM-DD" strings instead of JS Date objects.
  // Log dates (workouts, water, sleep) must never shift with the server's timezone.
  dateStrings: ["DATE"],
  // Return DECIMAL columns (bmi, sleep_hours...) as numbers instead of strings.
  decimalNumbers: true,
});
