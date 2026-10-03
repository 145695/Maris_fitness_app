const { badRequest } = require("../utils/errors");
const { ageFromBirthDate } = require("../utils/age");

const EXTRA_REST_BY_AGE = [
  { min: 0, max: 29, extraRest: 0 },
  { min: 30, max: 39, extraRest: 1 },
  { min: 40, max: 49, extraRest: 2 },
  { min: 50, max: 59, extraRest: 3 },
  { min: 60, max: Infinity, extraRest: 3 },
];

const MINUTES_PER_HEALTH_ISSUE = 45;
const MIN_SESSION_MINUTES = 15;

const CATEGORY_TIER_PREFERENCE = {
  Muscular: ["Extreme", "Hard", "Normal", "Easy"],
  Normal: ["Hard", "Normal", "Extreme", "Easy"],
  "Skinny Fat": ["Normal", "Easy", "Hard", "Extreme"],
  Fat: ["Easy", "Normal", "Hard", "Extreme"],
};

const EXERCISE_COUNT_SESSION_THRESHOLD_MIN = 90;

// B5: explicit validation. buildAdjustedPlan previously trusted its inputs.
function validatePlanInputs({
  age,
  availabilityHoursPerDay,
  healthIssueCount,
  category,
}) {
  if (!Number.isInteger(age) || age < 0 || age > 120) {
    throw badRequest("age must be an integer between 0 and 120", { age });
  }
  if (
    typeof availabilityHoursPerDay !== "number" ||
    !Number.isFinite(availabilityHoursPerDay) ||
    availabilityHoursPerDay <= 0 ||
    availabilityHoursPerDay > 24
  ) {
    throw badRequest(
      "availabilityHoursPerDay must be a number greater than 0 and at most 24",
      { availabilityHoursPerDay },
    );
  }
  if (
    !Number.isInteger(healthIssueCount) ||
    healthIssueCount < 0 ||
    healthIssueCount > 100
  ) {
    throw badRequest("healthIssueCount must be an integer between 0 and 100", {
      healthIssueCount,
    });
  }
  if (!CATEGORY_TIER_PREFERENCE[category]) {
    throw badRequest(`Unknown category "${category}"`, {
      allowed: Object.keys(CATEGORY_TIER_PREFERENCE),
    });
  }
}

function extraRestDaysForAge(age) {
  const bracket = EXTRA_REST_BY_AGE.find((b) => age >= b.min && age <= b.max);
  return bracket ? bracket.extraRest : 0;
}

function applyAgeRestDays(planDays, age) {
  const extraRest = extraRestDaysForAge(age);
  const days = planDays.map((d) => ({ ...d }));
  let toConvert = extraRest;
  for (let i = days.length - 1; i >= 0 && toConvert > 0; i--) {
    if (!days[i].is_rest) {
      days[i] = { day: days[i].day, is_rest: true, types: [] };
      toConvert--;
    }
  }
  const daysPerWeek = days.filter((d) => !d.is_rest).length;
  return { days, extraRestDaysApplied: extraRest - toConvert, daysPerWeek };
}

function adjustSessionMinutes(plan, availabilityHoursPerDay, healthIssueCount) {
  const availableMinutes = availabilityHoursPerDay * 60;
  const cappedByPlan = Math.min(plan.session_minutes.max, availableMinutes);
  const reduction = healthIssueCount * MINUTES_PER_HEALTH_ISSUE;
  return Math.max(MIN_SESSION_MINUTES, Math.round(cappedByPlan - reduction));
}

function exerciseCountForSession(sessionMinutes) {
  return sessionMinutes >= EXERCISE_COUNT_SESSION_THRESHOLD_MIN ? 5 : 4;
}

const WEIGHTED_EQUIPMENT = new Set([
  "barbell",
  "dumbbell",
  "dumbbells",
  "kettlebells",
  "machine",
  "cable",
  "cables",
  "e-z curl bar",
  "weight bench",
  "medicine ball",
]);

function prescriptionFor(e) {
  if (e.reps === undefined) return e.duration;
  const weighted = WEIGHTED_EQUIPMENT.has(
    String(e.equipment || "").toLowerCase(),
  );
  return weighted
    ? `Use the heaviest weight you can manage for ${e.reps} reps.`
    : `${e.reps} reps, bodyweight.`;
}

// --- B5: seeded shuffle -----------------------------------------------------

// mulberry32 - small, fast, deterministic.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a so string seeds (usernames, personIds) map to a stable uint32.
function hashSeed(input) {
  const s = String(input);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// The array is already sorted by tier, so same-tier items are contiguous.
// Shuffle inside each run, never across runs - tier order is preserved.
function shuffleWithinTiers(sortedArr, rankFn, seed) {
  const rng = mulberry32(hashSeed(seed));
  let i = 0;
  while (i < sortedArr.length) {
    let j = i + 1;
    const r = rankFn(sortedArr[i].difficulty);
    while (j < sortedArr.length && rankFn(sortedArr[j].difficulty) === r) j++;
    for (let k = j - 1; k > i; k--) {
      const m = i + Math.floor(rng() * (k - i + 1));
      [sortedArr[k], sortedArr[m]] = [sortedArr[m], sortedArr[k]];
    }
    i = j;
  }
}

// --- B5: fixed pickExercisesForType ----------------------------------------

/**
 * Fetch every exercise for a type, ordered by the category's tier preference.
 * Returns exercise_id (from Mongo _id) so callers can reference exercises later.
 * Pass { seed } for a stable-but-not-DB-order shuffle inside each tier.
 */
async function pickExercisesForType(db, type, category, count, { seed } = {}) {
  const preference =
    CATEGORY_TIER_PREFERENCE[category] || CATEGORY_TIER_PREFERENCE.Normal;

  // Unknown difficulty -> rank === preference.length -> sorts after all known tiers.
  const rank = (d) => {
    const i = preference.indexOf(d);
    return i === -1 ? preference.length : i;
  };

  const all = await db
    .collection("exercises")
    .find({ types: type })
    .project({
      // _id intentionally kept so we can surface it as exercise_id.
      name: 1,
      muscle_group: 1,
      equipment: 1,
      difficulty: 1,
      reps: 1,
      duration: 1,
    })
    .toArray();

  all.sort((a, b) => rank(a.difficulty) - rank(b.difficulty));

  if (seed !== undefined) {
    shuffleWithinTiers(all, rank, seed);
  }

  return all.slice(0, count).map((e) => {
    const { _id, ...rest } = e;
    return {
      exercise_id: String(_id),
      ...rest,
      prescription: prescriptionFor(e),
    };
  });
}

async function pickExercisesForDay(
  db,
  day,
  category,
  sessionMinutes,
  { seed } = {},
) {
  const count = exerciseCountForSession(sessionMinutes);
  const perType = {};
  for (const type of day.types) {
    perType[type] = await pickExercisesForType(db, type, category, count, {
      seed,
    });
  }
  return perType;
}

// --- B5: buildAdjustedPlan now validates + accepts birthDate ---------------

async function buildAdjustedPlan(db, plan, input) {
  const { availabilityHoursPerDay, healthIssueCount, category } = input;

  // Accept either a pre-computed age or a birthDate; prefer age if both given.
  const age =
    input.age !== undefined ? input.age : ageFromBirthDate(input.birthDate);

  validatePlanInputs({
    age,
    availabilityHoursPerDay,
    healthIssueCount,
    category,
  });

  const { days, extraRestDaysApplied, daysPerWeek } = applyAgeRestDays(
    plan.days,
    age,
  );
  const sessionMinutes = adjustSessionMinutes(
    plan,
    availabilityHoursPerDay,
    healthIssueCount,
  );

  const seed = input.seed; // optional: pass personId for per-user stability
  const daysWithExercises = [];
  for (const day of days) {
    daysWithExercises.push({
      ...day,
      exercises: day.is_rest
        ? {}
        : await pickExercisesForDay(db, day, category, sessionMinutes, {
            seed,
          }),
    });
  }

  return {
    plan_id: plan._id,
    plan_name: plan.name,
    original_days_per_week: plan.days_per_week,
    extra_rest_days_applied: extraRestDaysApplied,
    adjusted_days_per_week: daysPerWeek,
    session_minutes: sessionMinutes,
    exercises_per_type: exerciseCountForSession(sessionMinutes),
    duration_weeks: plan.duration_weeks,
    days: daysWithExercises,
  };
}

module.exports = {
  extraRestDaysForAge,
  applyAgeRestDays,
  adjustSessionMinutes,
  exerciseCountForSession,
  pickExercisesForType,
  pickExercisesForDay,
  buildAdjustedPlan,
  prescriptionFor,
  validatePlanInputs,
  MINUTES_PER_HEALTH_ISSUE,
  MIN_SESSION_MINUTES,
  CATEGORY_TIER_PREFERENCE,
};
