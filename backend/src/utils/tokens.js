// Token helpers: signing / verifying access JWTs and storing / rotating /
// revoking opaque refresh tokens.
//
// Access tokens  -> short-lived JWTs (config.jwt.accessTtl, default 15m).
// Refresh tokens -> long-lived OPAQUE random strings. Only a sha-256 hash is
//                   stored in MySQL (refresh_tokens.token_hash), so a leaked
//                   database can never leak usable tokens. Rotation revokes
//                   the old hash and inserts a new one in one transaction.
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const config = require("../config");
const { AppError, unauthorized } = require("./errors");

const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const refreshTtlMs = () => config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------
// Access tokens (JWT)
// ---------------------------------------------------------------------
function signAccessToken(user) {
  if (!config.jwt.accessSecret) {
    throw new AppError(
      500,
      "CONFIG_ERROR",
      "JWT_ACCESS_SECRET is not configured",
    );
  }
  return jwt.sign(
    { sub: String(user.id), pid: user.personId, username: user.username },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessTtl },
  );
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.jwt.accessSecret);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new AppError(401, "TOKEN_EXPIRED", "Access token has expired");
    }
    throw unauthorized("Invalid access token");
  }
}

// ---------------------------------------------------------------------
// Refresh tokens (opaque, hashed at rest)
// ---------------------------------------------------------------------
function generateRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

async function saveRefreshToken(pool, userId, refreshToken) {
  const expiresAt = new Date(Date.now() + refreshTtlMs());
  await pool.query(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
    [userId, sha256(refreshToken), expiresAt],
  );
  return expiresAt;
}

/**
 * Rotation, done atomically:
 *   1. lock the row by hash (SELECT ... FOR UPDATE)
 *   2. reject if missing, already revoked or expired
 *   3. revoke the old row and insert the new hash
 * A revoked token being presented again means it was reused (stolen or a
 * race between two clients) - every token of that user is revoked.
 */
async function rotateRefreshToken(pool, presentedToken) {
  const presentedHash = sha256(presentedToken);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT id, user_id, expires_at, revoked_at
         FROM refresh_tokens
        WHERE token_hash = ?
        FOR UPDATE`,
      [presentedHash],
    );
    const row = rows[0];

    if (!row) {
      await conn.rollback();
      throw unauthorized("Unknown refresh token");
    }
    if (row.revoked_at) {
      await conn.query(
        "UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL",
        [row.user_id],
      );
      await conn.rollback();
      throw unauthorized("Refresh token reuse detected");
    }
    if (new Date(row.expires_at) <= new Date()) {
      await conn.rollback();
      throw unauthorized("Refresh token has expired");
    }

    await conn.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?", [
      row.id,
    ]);
    const refreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + refreshTtlMs());
    await conn.query(
      "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
      [row.user_id, sha256(refreshToken), expiresAt],
    );
    await conn.commit();
    return { userId: row.user_id, refreshToken, expiresAt };
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* connection already rolled back / broken */
    }
    throw err;
  } finally {
    conn.release();
  }
}

/** Logout: best-effort revoke. Unknown tokens are ignored. */
async function revokeRefreshToken(pool, refreshToken) {
  await pool.query(
    "UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL",
    [sha256(refreshToken)],
  );
}

// ---------------------------------------------------------------------
// Convenience
// ---------------------------------------------------------------------
function issueTokenPair(user) {
  return {
    accessToken: signAccessToken(user),
    refreshToken: generateRefreshToken(),
  };
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  saveRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  issueTokenPair,
};
