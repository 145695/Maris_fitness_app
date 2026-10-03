// Given a stored plan document and today's date, work out which day of the
// plan we're on.
//
// Plan days cycle from `plan.started_at`. Day 1 is always started_at, day 7
// is started_at + 6, day 8 wraps to day 1 of week 2. The DB guarantees
// started_at is the day the user took the test.

const { daysBetween } = require("../utils/dates");

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {object} planDoc  A document from the `assigned_plans` collection.
 *                          Must have `started_at` and `days` (each entry
 *                          has `day`, `is_rest`, `types`, and optionally
 *                          `exercises`).
 * @param {string} todayIso Today in the user's timezone, YYYY-MM-DD.
 * @returns {{ weekNumber:number, dayNumber:number, isRest:boolean,
 *             types:string[], exercises:object } | null}
 *          null if todayIso is before the plan starts.
 */
function planDayFor(planDoc, todayIso) {
  if (!planDoc || typeof planDoc.started_at !== "string") {
    throw new Error("planDayFor: planDoc.started_at (YYYY-MM-DD) required");
  }
  if (!Array.isArray(planDoc.days) || planDoc.days.length === 0) {
    throw new Error("planDayFor: planDoc.days must be a non-empty array");
  }
  if (typeof todayIso !== "string" || !ISO_DATE.test(todayIso)) {
    throw new Error("planDayFor: todayIso must be YYYY-MM-DD");
  }

  const daysSinceStart = daysBetween(planDoc.started_at, todayIso);
  if (daysSinceStart < 0) return null;

  const dayNumber = (daysSinceStart % 7) + 1;
  const weekNumber = Math.floor(daysSinceStart / 7) + 1;

  const entry = planDoc.days.find((d) => d.day === dayNumber);
  if (!entry) return null;

  return {
    weekNumber,
    dayNumber,
    isRest: !!entry.is_rest,
    types: entry.types ?? [],
    exercises: entry.exercises ?? {},
  };
}

module.exports = { planDayFor };
