// Zod schemas for the profile endpoints (B4, B6, B7, B8, B9).
const { z } = require("zod");
const { AVATAR_SHAPE_IDS, AVATAR_COLOR_IDS } = require("./avatars");

// PATCH /me/avatar — partial update, at least one field.
const avatarPatchSchema = z
  .object({
    avatarShape: z.enum(AVATAR_SHAPE_IDS),
    avatarColor: z.enum(AVATAR_COLOR_IDS),
  })
  .partial()
  .refine((v) => v.avatarShape !== undefined || v.avatarColor !== undefined, {
    message: "Provide avatarShape and/or avatarColor",
  });

// POST /me/test — one-shot profile write + plan generation.
// All inputs are required the first time; the persons row is NULL until now.
const submitTestSchema = z.object({
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "birthDate must be YYYY-MM-DD"),
  heightCm: z.number().min(100).max(250),
  weightKg: z.number().min(25).max(400),
  jobType: z.enum(["Sedentary", "Light Movement", "Active", "Heavy Physical"]),
  weightTraining: z.enum(["Low", "Moderate", "High"]),
  cardioHistory: z.enum(["Low", "Moderate", "High"]),
  availabilityHoursPerDay: z.number().gt(0).lte(24),
  healthIssueCount: z.number().int().min(0).max(5),
  goalId: z.string().regex(/^G\d{2}$/, "goalId must look like G03"),

  // Needed only to compute the macro estimate in the response.
  // Not persisted — persons has no gender column (yet).
  gender: z.enum(["male", "female"]),
});

// A real YYYY-MM-DD calendar date. Rejects 2025-13-99 and 2025-02-30, both
// of which pass a plain regex.
const isoCalendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
  .refine((s) => {
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m - 1 &&
      dt.getUTCDate() === d
    );
  }, "date is not a real calendar date");

// PUT /me/workouts/:date and GET /me/workouts/:date
const workoutDateParams = z.object({ date: isoCalendarDate });

// PUT /me/workouts/:date — full set of checked-off exercise ids.
// PUT has replace semantics, so the client sends the complete list each time.
const workoutPutSchema = z.object({
  completedExerciseIds: z.array(z.string().min(1).max(64)).max(200).default([]),
});

// PATCH /me/daily — partial update of today's water + sleep.
// At least one field required. `null` clears a field; omitting it leaves
// the existing value untouched.
const dailyLogPatchSchema = z
  .object({
    waterMl: z.number().int().min(0).max(10000).nullable(),
    sleepHours: z.number().min(0).max(24).nullable(),
  })
  .partial()
  .refine((v) => v.waterMl !== undefined || v.sleepHours !== undefined, {
    message: "Provide waterMl and/or sleepHours",
  });
// GET /me/streak?days=7 — query string, coerced to int.
const streakQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});
// GET /me/daily/:date and PATCH /me/daily/:date
const dailyDateParams = z.object({ date: isoCalendarDate });

// GET /me/daily/recent?days=30 — query string, coerced to int.
const dailyRecentQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});
// POST /me/food — increments today's macro totals.
const foodAddSchema = z.object({
  calories: z.number().int().min(0).max(5000).optional(),
  protein_g: z.number().int().min(0).max(500).optional(),
  carbs_g: z.number().int().min(0).max(1000).optional(),
  fat_g: z.number().int().min(0).max(500).optional(),
});
module.exports = {
  avatarPatchSchema,
  submitTestSchema,
  isoCalendarDate,
  workoutDateParams,
  workoutPutSchema,
  dailyLogPatchSchema,
  streakQuerySchema,
  dailyDateParams,
  dailyRecentQuerySchema,
  foodAddSchema,
};
