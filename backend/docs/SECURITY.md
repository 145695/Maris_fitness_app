# Security review

Living document. Last reviewed: {{today}}.

## Threat model

Mobile-first fitness app. Untrusted clients, single-tenant backend, no PII
beyond what the user voluntarily submits (name, birth date, body metrics).

## What's in place

### Authentication
- JWT access tokens, short TTL (15m), HS256, secret from env (32+ chars).
- Refresh tokens: random 32-byte hex, stored **hashed** (SHA-256) in
  `refresh_tokens.token_hash`. Rotation on every refresh; the old row is
  marked `revoked_at`. **Reuse detection**: presenting a revoked token
  invalidates the whole family (see `POST /auth/refresh` "reuse detected").
- Logout revokes the refresh row and does not delete it, so replay still
  triggers reuse detection.
- `requireAuth` sets `req.user = { id, username, personId }` and rejects
  missing/malformed `Authorization: Bearer` headers with 401.

### Passwords
- bcrypt, cost 10. No plaintext ever leaves the request handler.
- Login returns the same 401 for unknown username and wrong password
  (no user enumeration via timing/response).

### Input validation
- Zod on every request body, path param, and query string. Applied by
  `src/middleware/validate.js`, which writes `req.validated.*`. Raw
  `req.body/params/query` is never read by handlers.
- Numeric bounds mirror the MySQL CHECK constraints, so a Zod-passing
  value can never trip a DB constraint (one less error path).
- `isoCalendarDate` rejects impossible dates (2025-13-99, 2025-02-30).

### SQL injection
- Every query uses `pool.query(sql, params)` with `?` placeholders. No
  string interpolation of user input into SQL anywhere.
- The only interpolated fragments are `sets.join(", ")` in
  `PATCH /me/avatar` and `INSERT INTO workout_log_exercises VALUES ?`.
  Both are built from a fixed allowlist of column names or from a
  validated array whose elements are already known exercise ids.

### NoSQL injection
- The only user-controlled input that reaches a Mongo query is
  `active.mongo_plan_id`, which comes from our own MySQL row, not the
  client. It is passed to `ObjectId()`; a malformed id throws and the
  error handler returns a generic 500 without leaking details.
- No handler accepts a raw filter document from the client.

### Authorization
- Every `/me/*` route runs `router.use(requireAuth)`.
- Every write is scoped to `req.user.personId`; there is no "personId in
  the request body" pattern.
- `GET /goals` is public (reference data for onboarding).
- `GET /health` is public.

### Secrets
- All env vars flow through `src/config.js`, which validates with Zod
  and exits at boot if production secrets are missing.
- `.env` is git-ignored. Nothing is committed.

### Error shape
- All deliberate failures throw `AppError`. The error handler returns
  `{ error: { code, message, details? } }` and never a stack trace.

### Refresh-token lifetime
- 30 days default. Absolute expiry enforced by `expires_at` in DB, checked
  on every refresh.

## Known gaps / to do

### High
- **Rate limiting is only on `/auth/*`.** `POST /me/test` and
  `PUT /me/workouts/:date` are unthrottled. Add `express-rate-limit` on
  all authenticated POST/PUT/PATCH routes with a per-user key.
- **`validate()` silently skips an undefined schema.** If a route passes
  `validate({ body: someSchema })` and `someSchema` is `undefined` (missing
  export, typo), the middleware falls through to unvalidated input. We hit
  this three times during development. See "Hardening" below.

### Medium
- **No `helmet`.** No security headers (CSP, X-Frame-Options, etc.).
  Trivial to add: `app.use(helmet())`.
- **No HTTPS enforcement at the app level.** Deployment concern; terminate
  TLS at the reverse proxy / load balancer.
- **No audit log.** No record of who changed what when. Fine at this
  scale; needed if there's ever a "why was my account modified" question.
- **`express.json()` body size limit is the default (100kb).** Fine for
  our payloads; explicitly set `{ limit: '50kb' }` to be tight.
- **No CSRF protection.** Not needed — we use bearer tokens, not cookies.
  Document this so no one "helpfully" adds cookie auth later.

### Low
- **`full_name` is stored unescaped.** MySQL parameterization prevents
  SQLi, but if the name is ever rendered into a web view it must be
  HTML-escaped client-side. Standard React/RN behavior, so not a concern
  in the current frontend.
- **No password complexity rule** beyond bcrypt cost. Acceptable for a
  personal-fitness app; would need strengthening before adding payment
  or PII-sharing features.
- **Mongo connection lacks auth in dev.** `mongodb://localhost:27017` has
  no credentials. Production should use `mongodb://user:pass@host` with
  a scoped user.

## Hardening to apply next

### 1. Make `validate()` fail loudly on a non-schema

```js
function validate({ body, params, query } = {}) {
  for (const [name, schema] of Object.entries({ body, params, query })) {
    if (schema !== undefined && typeof schema.parse !== "function") {
      throw new Error(
        `validate(): '${name}' was passed but isn't a Zod schema`,
      );
    }
  }
  return (req, res, next) => { /* unchanged */ };
}