// requireAuth: guards routes behind a valid access token.
//
//   router.get("/me", requireAuth, handler);
//
// Reads `Authorization: Bearer <accessToken>`, verifies it and loads the
// user from MySQL (so deleted users lose access immediately, even with a
// still-valid token). The user is attached as:
//   req.user = { id, username, personId }
//
// Every failure is an AppError -> 401 in the standard error shape.
const pool = require("../db/mysql");
const { verifyAccessToken } = require("../utils/tokens");
const { unauthorized } = require("../utils/errors");

async function requireAuth(req, res, next) {
  const header = req.get("Authorization") || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(unauthorized("Missing or malformed Authorization header"));
  }

  const payload = verifyAccessToken(token); // throws AppError on any failure

  const [rows] = await pool.query(
    "SELECT id, username, person_id FROM users WHERE id = ?",
    [payload.sub],
  );
  const user = rows[0];
  if (!user) {
    return next(unauthorized("Account no longer exists"));
  }

  req.user = { id: user.id, username: user.username, personId: user.person_id };
  next();
}

module.exports = { requireAuth };
