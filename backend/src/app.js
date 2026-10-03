const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const config = require("./config");
const routes = require("./routes");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();

// Security headers first — they apply to every response including errors.
app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header = native mobile app, curl, server-to-server: allow.
      if (!origin) return callback(null, true);
      if (
        config.cors.origins.includes("*") ||
        config.cors.origins.includes(origin)
      ) {
        return callback(null, true);
      }
      const err = new Error("Origin not allowed");
      err.code = "CORS_NOT_ALLOWED";
      return callback(err);
    },
  }),
);

// 50kb is 100x our largest legitimate payload (POST /me/test ~400 bytes).
app.use(express.json({ limit: "50kb" }));

app.use(routes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
