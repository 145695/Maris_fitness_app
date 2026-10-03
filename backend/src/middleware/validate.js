const { ZodError } = require("zod");

/**
 * Validates body / params / query with zod schemas.
 *
 *   router.post("/x", validate({ body: schema }), (req, res) => {
 *     const { body, params, query } = req.validated;
 *   });
 *
 * Validated (and cleaned / coerced) data goes on req.validated. We do not
 * overwrite req.query because it is read-only in Express 5.
 * Any failure throws a ZodError, which the error handler turns into a 400.
 */
function validate({ body, params, query } = {}) {
  // Fail fast at route-registration time. An undefined/null schema is fine
  // (that validator is just skipped), but a non-schema value means a missing
  // export or a typo, and silently skipping it lets bad input through.
  for (const [name, schema] of Object.entries({ body, params, query })) {
    if (schema == null) continue;
    if (typeof schema.parse !== "function") {
      throw new Error(
        `validate(): '${name}' was passed but is not a Zod schema`,
      );
    }
  }

  return (req, res, next) => {
    try {
      req.validated = {
        body: body ? body.parse(req.body ?? {}) : req.body,
        params: params ? params.parse(req.params) : req.params,
        query: query ? query.parse(req.query) : req.query,
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = validate;
