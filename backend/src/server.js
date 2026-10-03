const config = require("./config");
const app = require("./app");
const pool = require("./db/mysql");
const { closeMongo } = require("./db/mongo");

// '0.0.0.0' lets your phone reach it on the local network
const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`API running on port ${config.port} (${config.env})`);
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    await Promise.allSettled([pool.end(), closeMongo()]);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref(); // safety net
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
