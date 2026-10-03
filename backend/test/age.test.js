const test = require("node:test");
const assert = require("node:assert/strict");
const { ageFromBirthDate } = require("../src/utils/age");

test("birthday already passed this year", () => {
  const now = new Date(2025, 5, 15); // 2025-06-15 local
  assert.equal(ageFromBirthDate("2000-01-01", now), 25);
});

test("birthday not yet reached this year", () => {
  const now = new Date(2025, 5, 15);
  assert.equal(ageFromBirthDate("2000-12-31", now), 24);
});

test("birthday is today", () => {
  const now = new Date(2025, 5, 15);
  assert.equal(ageFromBirthDate("2000-06-15", now), 25);
});

test("leap-day birthday, non-leap year, day before", () => {
  const now = new Date(2025, 1, 28); // 2025-02-28
  assert.equal(ageFromBirthDate("2000-02-29", now), 24);
});

test("leap-day birthday, non-leap year, day after", () => {
  const now = new Date(2025, 2, 1); // 2025-03-01
  assert.equal(ageFromBirthDate("2000-02-29", now), 25);
});

test("invalid inputs return null", () => {
  assert.equal(ageFromBirthDate(null), null);
  assert.equal(ageFromBirthDate(""), null);
  assert.equal(ageFromBirthDate("not-a-date"), null);
  assert.equal(ageFromBirthDate(new Date("invalid")), null);
  assert.equal(ageFromBirthDate(12345), null);
});
