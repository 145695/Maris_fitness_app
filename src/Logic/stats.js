const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// month is 0-11
export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// fixed pseudo-random numbers so the fake data doesn't change on every render
function rand(seed) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/**
 * Everything the stats page needs for one month.
 *
 * days:   one entry per day, percent = share of that day's workout he finished
 *         (0-100), or null if the day hasn't happened yet
 * weeks:  4 buckets (days 1-7, 8-14, 15-21, 22-end) with average weight and
 *         total minutes trained, null while the week hasn't started
 * totals: the summary numbers
 */
export async function getMonthStats(year, month) {
  await wait();
  // TODO: GET /stats?year=YYYY&month=M  -> return the same shape

  const now = new Date();
  const total = daysInMonth(year, month);
  const isFuture =
    year > now.getFullYear() ||
    (year === now.getFullYear() && month > now.getMonth());
  const isCurrent = year === now.getFullYear() && month === now.getMonth();
  const lastDay = isFuture ? 0 : isCurrent ? now.getDate() : total;

  const days = Array.from({ length: total }, (_, i) => {
    const day = i + 1;
    if (day > lastDay) return { day, percent: null };
    const r = rand(year * 400 + month * 40 + day);
    const trained = r > 0.3;
    return {
      day,
      percent: trained ? Math.round(50 + rand(day + month) * 50) : 0,
    };
  });

  const weeks = [0, 1, 2, 3].map((w) => {
    const from = w * 7 + 1;
    const to = w === 3 ? total : from + 6;
    const slice = days.filter(
      (d) => d.day >= from && d.day <= to && d.percent !== null,
    );
    if (slice.length === 0)
      return { label: `w${w + 1}`, weight: null, minutes: null };
    return {
      label: `w${w + 1}`,
      weight: Math.round((82 - w * 0.6 - month * 0.1) * 10) / 10,
      minutes: Math.round(slice.reduce((s, d) => s + d.percent * 0.6, 0)),
    };
  });

  const played = days.filter((d) => d.percent !== null);
  const done = played.filter((d) => d.percent > 0);
  const totals = {
    workoutsDone: done.length,
    workoutsPlanned: played.length,
    minutes: weeks.reduce((s, w) => s + (w.minutes ?? 0), 0),
    avgPercent: done.length
      ? Math.round(done.reduce((s, d) => s + d.percent, 0) / done.length)
      : 0,
  };

  return { year, month, days, weeks, totals };
}
