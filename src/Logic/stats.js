import { apiFetch } from "./api";

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export async function getMonthStats(year, month) {
  const now = new Date();
  const total = daysInMonth(year, month);
  const isFuture =
    year > now.getFullYear() ||
    (year === now.getFullYear() && month > now.getMonth());
  const isCurrent = year === now.getFullYear() && month === now.getMonth();
  const lastDay = isFuture ? 0 : isCurrent ? now.getDate() : total;

  // Pull last 90 days of workout statuses AND sleep/water.
  let byDate = new Map();
  let sleepByDate = new Map();
  try {
    const [streak, daily] = await Promise.all([
      apiFetch("/me/streak?days=90"),
      apiFetch("/me/daily/recent?days=90"),
    ]);
    byDate = new Map(streak.days.map((d) => [d.date, d.status]));
    sleepByDate = new Map(
      daily.days.map((d) => [d.date, d.sleepHours]),
    );
  } catch {
    // fall through — return zeros
  }

  const iso = (day) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const days = Array.from({ length: total }, (_, i) => {
    const day = i + 1;
    if (day > lastDay) return { day, percent: null, sleepHours: null };
    const key = iso(day);
    const status = byDate.get(key);
    const sleep = sleepByDate.get(key);
    return {
      day,
      percent: status === "completed" ? 100 : 0,
      sleepHours: sleep ?? null,
    };
  });

  const weeks = [0, 1, 2, 3].map((w) => {
    const from = w * 7 + 1;
    const to = w === 3 ? total : from + 6;
    const slice = days.filter(
      (d) => d.day >= from && d.day <= to && d.percent !== null,
    );
    if (slice.length === 0) {
      return { label: `w${w + 1}`, sleepHours: null, minutes: null };
    }

    // Average sleep across days this week that had a sleep entry.
    const sleeps = slice
      .map((d) => d.sleepHours)
      .filter((h) => h !== null && h !== undefined);
    const avgSleep = sleeps.length
      ? Math.round((sleeps.reduce((s, h) => s + h, 0) / sleeps.length) * 10) / 10
      : null;

    return {
      label: `w${w + 1}`,
      sleepHours: avgSleep,
      minutes: Math.round(slice.reduce((s, d) => s + d.percent * 0.6, 0)),
    };
  });

  const played = days.filter((d) => d.percent !== null);
  const done = played.filter((d) => d.percent > 0);

  // Overall average sleep for the month
  const allSleeps = days
    .map((d) => d.sleepHours)
    .filter((h) => h !== null && h !== undefined);
  const avgSleepMonth = allSleeps.length
    ? Math.round((allSleeps.reduce((s, h) => s + h, 0) / allSleeps.length) * 10) / 10
    : null;

  const totals = {
    workoutsDone: done.length,
    workoutsPlanned: played.length,
    minutes: weeks.reduce((s, w) => s + (w.minutes ?? 0), 0),
    avgPercent: done.length
      ? Math.round(done.reduce((s, d) => s + d.percent, 0) / done.length)
      : 0,
    avgSleepHours: avgSleepMonth,
  };

  return { year, month, days, weeks, totals };
}