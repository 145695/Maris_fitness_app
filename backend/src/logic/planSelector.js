const { notFound } = require("../utils/errors");

function slug(s) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Looks up the one plan document that matches this goal type + category. */
async function selectPlan(db, goalType, category) {
  const planId = `${slug(goalType)}__${slug(category)}`;
  const plan = await db.collection("plans").findOne({ _id: planId });
  if (!plan) {
    throw notFound(
      `No plan found for goal type "${goalType}" + category "${category}" (looked for _id "${planId}")`,
    );
  }
  return plan;
}

module.exports = { selectPlan, slug };
