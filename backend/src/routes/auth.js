// Auth endpoints. All failures go through AppError, so the client always
// receives the standard shape: { error: { code, message, details? } }.
//
//   POST /auth/register  { username, password, fullName, timezone? } -> 201
//   POST /auth/login     { username, password }                      -> 200
//   POST /auth/refresh   { refreshToken }                          -> 200
//   POST /auth/logout    { refreshToken? }   (Bearer required)     -> 204
//   GET  /auth/me                              (Bearer required)     -> 200
const { Router } = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const pool = require("../db/mysql");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
} = require("../utils/authSchemas");
const {
  issueTokenPair,
  saveRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} = require("../utils/tokens");
const { AppError, conflict, unauthorized } = require("../utils/errors");

const router = Router();

// Throttle credential endpoints per IP (50 attempts / 15 min).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: "RATE_LIMITED", message: "Too many attempts, try again later" },
  },
});

const BCRYPT_ROUNDS = 10;

async function findUserById(id) {
  const [rows] = await pool.query(
    "SELECT id, username, person_id FROM users WHERE id = ?",
    [id],
  );
  return rows[0];
}

// ---------------------------------------------------------------------
// POST /auth/register
// Creates the person profile row first, then the user row, atomically.
// ---------------------------------------------------------------------
router.post(
  "/register",
  authLimiter,
  validate({ body: registerSchema }),
  async (req, res) => {
    const { username, password, fullName, timezone } = req.validated.body;

    const [existing] = await pool.query(
      "SELECT id FROM users WHERE username = ?",
      [username],
    );
    if (existing.length) {
      throw conflict("Username is already taken", "USERNAME_TAKEN");
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const conn = await pool.getConnection();
    let userId;
    let personId;
    try {
      await conn.beginTransaction();
      const [personResult] = await conn.query(
        "INSERT INTO persons (full_name, timezone) VALUES (?, ?)",
        [fullName, timezone],
      );
      personId = personResult.insertId;
      const [userResult] = await conn.query(
        "INSERT INTO users (username, password_hash, person_id) VALUES (?, ?, ?)",
        [username, passwordHash, personId],
      );
      userId = userResult.insertId;
      await conn.commit();
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        /* connection already broken */
      }
      throw err;
    } finally {
      conn.release();
    }

    const user = { id: userId, username, personId };
    const tokens = issueTokenPair(user);
    await saveRefreshToken(pool, userId, tokens.refreshToken);

    res.status(201).json({ user, tokens });
  },
);

// ---------------------------------------------------------------------
// POST /auth/login
// One generic 401 for "no such user" and "wrong password" so the endpoint
// cannot be used to enumerate usernames.
// ---------------------------------------------------------------------
router.post(
  "/login",
  authLimiter,
  validate({ body: loginSchema }),
  async (req, res) => {
    const { username, password } = req.validated.body;

    const [rows] = await pool.query(
      "SELECT id, username, person_id, password_hash FROM users WHERE username = ?",
      [username],
    );
    const user = rows[0];
    const passwordOk = user && (await bcrypt.compare(password, user.password_hash));
    if (!passwordOk) {
      throw unauthorized("Invalid username or password");
    }

    const safeUser = { id: user.id, username: user.username, personId: user.person_id };
    const tokens = issueTokenPair(safeUser);
    await saveRefreshToken(pool, user.id, tokens.refreshToken);

    res.json({ user: safeUser, tokens });
  },
);

// ---------------------------------------------------------------------
// POST /auth/refresh  -> rotate: old refresh token dies, new pair is issued
// ---------------------------------------------------------------------
router.post(
  "/refresh",
  authLimiter,
  validate({ body: refreshSchema }),
  async (req, res) => {
    const { refreshToken } = req.validated.body;

    const rotated = await rotateRefreshToken(pool, refreshToken);
    const user = await findUserById(rotated.userId);
    if (!user) {
      throw new AppError(401, "UNAUTHORIZED", "Account no longer exists");
    }

    res.json({
      user: { id: user.id, username: user.username, personId: user.person_id },
      tokens: {
        accessToken: require("../utils/tokens").signAccessToken(user),
        refreshToken: rotated.refreshToken,
      },
    });
  },
);

// ---------------------------------------------------------------------
// POST /auth/logout  -> revoke the presented refresh token (best effort)
// ---------------------------------------------------------------------
router.post(
  "/logout",
  requireAuth,
  validate({ body: logoutSchema }),
  async (req, res) => {
    const { refreshToken } = req.validated.body;
    if (refreshToken) {
      await revokeRefreshToken(pool, refreshToken);
    }
    res.status(204).end();
  },
);

// ---------------------------------------------------------------------
// GET /auth/me  -> sanity check for the access token
// ---------------------------------------------------------------------
router.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
