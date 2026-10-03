import { QUOTES } from "../constants/quotes";

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

// Monday = 0 ... Sunday = 6
export function todayIndex() {
  return (new Date().getDay() + 6) % 7;
}

// ---- each function below is one future API call ----

export async function getUser() {
  await wait();
  // TODO: GET /me
  return { name: "Maria" };
}

// true = he finished that day's workout
export async function getWeek() {
  await wait();
  // TODO: GET /workouts/week
  const fake = [true, true, true, false, false, false, false];
  return fake.map((done, i) => done && i <= todayIndex());
}

// what he logged today (sleep + water)
// Fake storage for today's entries (in memory, resets when the app restarts).
// Sleep is the total hours slept, water is the total liters drunk today.
let todayStats = {
  sleep: { value: 6.5, goal: 8, unit: "h" },
  water: { value: 1.2, goal: 2.5, unit: "L" },
};

export async function getTodayStats() {
  await wait();
  // TODO: GET /stats/today
  return {
    sleep: { ...todayStats.sleep },
    water: { ...todayStats.water },
  };
}

// type = "sleep" | "water", value = the new total for today
export async function saveStat(type, value) {
  const clean = Math.max(0, Math.round(Number(value) * 100) / 100);
  if (!Number.isFinite(clean)) return { ok: false, error: "Invalid value." };
  todayStats = { ...todayStats, [type]: { ...todayStats[type], value: clean } };
  // TODO: PUT /stats/today/:type { value }   (the server should key it by date)
  return { ok: true };
}
// targets come from the plan generator, "value" is what he ate so far
export async function getMacros() {
  await wait();
  // TODO: GET /plan/macros
  return [
    { label: "calories", value: 1240, goal: 2100, unit: "kcal" },
    { label: "protein", value: 92, goal: 140, unit: "g" },
    { label: "carbs", value: 130, goal: 220, unit: "g" },
    { label: "fat", value: 41, goal: 65, unit: "g" },
  ];
}

// same quote all day, changes at midnight
export function getQuote() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - start) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}

// ---- pure logic (stays here even with a backend) ----

// consecutive finished days ending today (or yesterday if today isn't done yet)
export function computeStreak(week, today) {
  let i = week[today] ? today : today - 1;
  let streak = 0;
  while (i >= 0 && week[i]) {
    streak++;
    i--;
  }
  return streak;
}

export function moodFromStreak(streak) {
  if (streak >= 3) return "happy";
  if (streak >= 1) return "sad";
  return "angry";
}

export async function getHomeData() {
  const [user, week, stats, macros] = await Promise.all([
    getUser(),
    getWeek(),
    getTodayStats(),
    getMacros(),
  ]);
  const today = todayIndex();
  // TODO: once the server tracks it, take the streak from the API
  // (this one only counts inside the current week)
  const streak = computeStreak(week, today);

  return {
    name: user.name,
    week,
    today,
    streak,
    mood: moodFromStreak(streak),
    stats,
    macros,
    quote: getQuote(),
  };
}
