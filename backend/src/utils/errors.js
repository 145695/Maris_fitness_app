// One error type for everything we throw on purpose.
// The error handler turns it into: { error: { code, message, details? } }
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

module.exports = {
  AppError,
  badRequest: (message, details) =>
    new AppError(400, "BAD_REQUEST", message, details),
  unauthorized: (message = "Authentication required") =>
    new AppError(401, "UNAUTHORIZED", message),
  forbidden: (message = "Not allowed") =>
    new AppError(403, "FORBIDDEN", message),
  notFound: (message = "Not found") => new AppError(404, "NOT_FOUND", message),
  conflict: (message, code = "CONFLICT") => new AppError(409, code, message),
};
