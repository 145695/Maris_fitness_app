// Date helpers. All operate on "YYYY-MM-DD" strings — no Date objects cross
// the module boundary, so the server's local timezone never leaks in.

// "Today" in the given IANA timezone as YYYY-MM-DD.
function todayInTimezone(tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// YYYY-MM-DD + N days -> YYYY-MM-DD. Pure UTC math, no DST surprises.
function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Whole days from isoA to isoB. Positive when isoB is later. DST-proof.
function daysBetween(isoA, isoB) {
  const [ya, ma, da] = isoA.split("-").map(Number);
  const [yb, mb, db] = isoB.split("-").map(Number);
  const a = Date.UTC(ya, ma - 1, da);
  const b = Date.UTC(yb, mb - 1, db);
  return Math.round((b - a) / 86400000);
}

module.exports = { todayInTimezone, addDays, daysBetween };
