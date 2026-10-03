#!/usr/bin/env node
// Interactive terminal test of the full pipeline: BMI -> category -> plan ->
// age/availability/health adjustment -> exercises -> macros.
// Nothing here touches MySQL or the app - it's a standalone test of the logic.
//
//   node scripts/cli-test.js

require("dotenv").config();
const readline = require("readline");
const { MongoClient } = require("mongodb");
const { classify } = require("../src/logic/classify");
const { selectPlan } = require("../src/logic/planSelector");
const { buildAdjustedPlan } = require("../src/logic/adjustPlan");
const { calculateMacros } = require("../src/logic/macros");

// Must match the goals table in database/schema.sql (11 goals, 9 goal types).
const GOALS = [
  ["G03", "Fat Loss", "Lose over all fat"],
  ["G11", "Muscle", "Bulking"],
  ["G12", "Muscle", "Get shredded / lean look"],
  ["G13", "Muscle", "Get stronger"],
  ["G14", "Body Transformation", "Full body transformation"],
  ["G17", "Endurance", "Improve stamina / endurance"],
  ["G18", "Posture", "Fix posture / relieve back pain"],
  ["G19", "Flexibility", "Do the splits / be flexible"],
  ["G20", "Health", "More energy / feel better / better sleep / less stress"],
  ["G22", "Habits", "Build a daily exercise habit"],
  ["G23", "Mobility", "More mobility and better movement"],
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const ask = (q) => new Promise((res) => rl.question(q, res));

async function askChoice(label, options) {
  console.log(`${label}: ${options.join(" / ")}`);
  while (true) {
    const a = (await ask("> ")).trim();
    const hit = options.find((o) => o.toLowerCase() === a.toLowerCase());
    if (hit) return hit;
    console.log(`Please type one of: ${options.join(", ")}`);
  }
}

// Asks for a number and keeps asking until it is inside [min, max].
// Ranges match the database CHECK constraints in schema.sql.
async function askNumber(
  label,
  { min = -Infinity, max = Infinity, integer = false } = {},
) {
  while (true) {
    const a = await ask(`${label}: `);
    const n = Number(a);
    if (a.trim() === "" || Number.isNaN(n)) {
      console.log("Please enter a number.");
    } else if (integer && !Number.isInteger(n)) {
      console.log("Please enter a whole number.");
    } else if (n < min || n > max) {
      const range = [
        min !== -Infinity ? `at least ${min}` : null,
        max !== Infinity ? `at most ${max}` : null,
      ]
        .filter(Boolean)
        .join(" and ");
      console.log(`Value must be ${range}.`);
    } else {
      return n;
    }
  }
}

(async () => {
  console.log("=== Fitness plan pipeline - terminal test ===\n");

  const heightCm = await askNumber("Height (cm, 100-250)", {
    min: 100,
    max: 250,
  });
  const weightKg = await askNumber("Weight (kg, 25-400)", {
    min: 25,
    max: 400,
  });
  const age = await askNumber("Age", { min: 10, max: 100, integer: true });
  const gender = await askChoice("Gender", ["male", "female"]);
  const jobType = await askChoice("Job Type", [
    "Sedentary",
    "Light Movement",
    "Active",
    "Heavy Physical",
  ]);
  const weightTraining = await askChoice("Weight Training level", [
    "Low",
    "Moderate",
    "High",
  ]);
  const cardioHistory = await askChoice("Cardio History", [
    "Low",
    "Moderate",
    "High",
  ]);
  const availabilityHoursPerDay = await askNumber(
    "Availability on a training day (hours, e.g. 1.5)",
    { min: 0.1, max: 24 },
  );
  const healthIssueCount = await askNumber("Number of health issues (0-5)", {
    min: 0,
    max: 5,
    integer: true,
  });

  console.log("\nGoals:");
  GOALS.forEach(([id, type, name]) =>
    console.log(`  ${id}  [${type}] ${name}`),
  );
  let goalId;
  while (true) {
    goalId = (await ask("Pick a goal id (e.g. G03): ")).trim().toUpperCase();
    if (GOALS.some((g) => g[0] === goalId)) break;
    console.log("Unknown goal id, try again.");
  }
  const [, goalType, goalName] = GOALS.find((g) => g[0] === goalId);

  rl.close();

  // ---- 1. BMI + category ----
  const { bmi, bmiGroup, category } = classify({
    heightCm,
    weightKg,
    jobType,
    weightTraining,
    cardioHistory,
  });

  console.log("\n--- Classification ---");
  console.log(`BMI: ${bmi}  (${bmiGroup})`);
  console.log(`Category: ${category}`);

  // ---- 2. connect to Mongo, pick the plan ----
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017";
  const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 4000 });
  try {
    await client.connect();
  } catch (e) {
    console.error(`\nCould not reach MongoDB (${mongoUri}): ${e.message}`);
    console.error("Is it running? (docker compose up -d)");
    process.exit(1);
  }
  const db = client.db(process.env.MONGO_DB || "fitness_app");

  try {
    let plan;
    try {
      plan = await selectPlan(db, goalType, category);
    } catch (e) {
      console.error("\n" + e.message);
      console.error("Did you load the plans? (npm run setup-db)");
      process.exitCode = 1;
      return;
    }

    console.log("\n--- Selected plan ---");
    console.log(`${plan.name}  (${plan._id})`);
    console.log(
      `Base: ${plan.days_per_week} days/week, ${plan.session_minutes.min}-${plan.session_minutes.max} min/session, ` +
        `${plan.duration_weeks == null ? "lifelong (no end date)" : plan.duration_weeks + " weeks"}`,
    );

    // ---- 3. adjust for age + availability + health ----
    const adjusted = await buildAdjustedPlan(db, plan, {
      age,
      availabilityHoursPerDay,
      healthIssueCount,
      category,
    });

    console.log("\n--- Adjusted for this person ---");
    console.log(
      `Days/week: ${adjusted.original_days_per_week} -> ${adjusted.adjusted_days_per_week} ` +
        `(${adjusted.extra_rest_days_applied} extra rest day(s) for age ${age})`,
    );
    console.log(
      `Session length: ${adjusted.session_minutes} min  (${adjusted.exercises_per_type} exercises per type)`,
    );

    for (const day of adjusted.days) {
      if (day.is_rest) {
        console.log(`  Day ${day.day}: Rest`);
        continue;
      }
      console.log(`  Day ${day.day}: ${day.types.join(", ")}`);
      for (const [type, list] of Object.entries(day.exercises)) {
        if (list.length === 0) {
          console.log(`      ${type}: (no exercises found for this type)`);
          continue;
        }
        list.forEach((e) => {
          const id = e.exercise_id ? ` {${e.exercise_id}}` : "";
          const level = e.difficulty ? ` (${e.difficulty})` : "";
          const equip = e.equipment ? ` - ${e.equipment}` : "";
          console.log(
            `      [${type}]${level} ${e.name}${equip} - ${e.prescription}${id}`,
          );
        });
      }
    }

    // ---- 4. macros, based on the FINAL adjusted days/week ----
    const macros = calculateMacros({
      weightKg,
      heightCm,
      age,
      gender,
      daysPerWeek: adjusted.adjusted_days_per_week,
      goalType,
    });

    console.log(
      "\n--- Estimated daily macros --- (rough estimate, not medical advice)",
    );
    console.log(`Goal: ${goalName} [${goalType}]`);
    console.log(
      `BMR: ${macros.bmr} kcal   TDEE: ${macros.tdee} kcal   Target: ${macros.calories} kcal/day`,
    );
    console.log(
      `Protein: ${macros.protein_g} g   Fat: ${macros.fat_g} g   Carbs: ${macros.carbs_g} g`,
    );
  } finally {
    await client.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
