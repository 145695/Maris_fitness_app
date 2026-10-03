const { ZodError } = require("zod");
const { AppError } = require("../utils/errors");
const config = require("../config");

function send(res, status, code, message, details) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  res.status(status).json({ error });
}

// Unknown route -> 404 in the standard shape.
function notFoundHandler(req, res) {
  send(res, 404, "NOT_FOUND", `Route not found: ${req.method} ${req.path}`);
}

// Central error handler. Must be registered LAST and keep its 4 arguments.
// Express 5 forwards errors from async handlers here automatically.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    return send(res, 400, "VALIDATION_ERROR", "Invalid request data", details);
  }
  if (err instanceof AppError) {
    return send(res, err.status, err.code, err.message, err.details);
  }
  // body-parser errors (bad JSON, body too large)
  if (err.type === "entity.parse.failed") {
    return send(res, 400, "INVALID_JSON", "Request body is not valid JSON");
  }
  if (err.type === "entity.too.large") {
    return send(res, 413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  }
  // CORS rejection from our cors() origin check
  if (err.code === "CORS_NOT_ALLOWED") {
    return send(res, 403, "CORS_NOT_ALLOWED", "Origin not allowed");
  }

  // Anything else is a bug or an infrastructure failure: log it, hide the details.
  console.error(err);
  return send(
    res,
    500,
    "INTERNAL_ERROR",
    config.isProduction
      ? "Something went wrong"
      : err.message || "Something went wrong",
  );
}

module.exports = { notFoundHandler, errorHandler };
