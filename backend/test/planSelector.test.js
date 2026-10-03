const test = require("node:test");
const assert = require("node:assert/strict");
const { slug, selectPlan } = require("../src/logic/planSelector");
const { AppError } = require("../src/utils/errors");

test("slug normalizes names", () => {
  assert.equal(slug("Fat Loss"), "fat_loss");
  assert.equal(slug("  Muscle  "), "muscle");
  assert.equal(slug("Skinny-Fat"), "skinny_fat");
});

test("selectPlan returns the plan when present", async () => {
  const fake = { _id: "muscle__muscular", name: "Muscle / Muscular" };
  const db = { collection: () => ({ findOne: async () => fake }) };
  const plan = await selectPlan(db, "Muscle", "Muscular");
  assert.equal(plan, fake);
});

test("selectPlan throws AppError(404) when missing", async () => {
  const db = { collection: () => ({ findOne: async () => null }) };
  await assert.rejects(
    () => selectPlan(db, "Muscle", "Muscular"),
    (err) =>
      err instanceof AppError && err.status === 404 && err.code === "NOT_FOUND",
  );
});
