import { QUOTES } from "../constants/quotes";
import { apiFetch } from "./api";

// Monday = 0 ... Sunday = 6
export function todayIndex() {
  return (new Date().getDay() + 6) % 7;
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function getUser() {
  const me = await apiFetch("/me");
  return { name: me.person.fullName };
}

// Build a Mon-Sun boolean array for the current week from /me/streak data.
function buildWeekFromStreak(days) {
  const byDate = new Map(days.map((d) => [d.date, d.status]));
  const week = Array(7).fill(false);
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - todayIndex());
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = toISO(d);
    week[i] = byDate.get(iso) === "completed";
  }
  return week;
}

export async function getWeek() {
  // 14 days covers the current week regardless of what day it is.
  const data = await apiFetch("/me/streak?days=14");
  return buildWeekFromStreak(data.days);
}

export async function getTodayStats() {
  const me = await apiFetch("/me");
  const today = me.today || {};
  return {
    sleep: {
      value: today.sleepHours ?? 0,
      goal: 8,
      unit: "h",
    },
    water: {
      // backend stores ml, frontend uses liters
      value: Math.round(((today.waterMl ?? 0) / 1000) * 100) / 100,
      goal: 2.5,
      unit: "L",
    },
  };
}

export async function saveStat(type, value) {
  const clean = Math.max(0, Math.round(Number(value) * 100) / 100);
  if (!Number.isFinite(clean)) return { ok: false, error: "Invalid value." };

  try {
    if (type === "water") {
      await apiFetch("/me/daily", {
        method: "PATCH",
        body: JSON.stringify({ waterMl: Math.round(clean * 1000) }),
      });
    } else if (type === "sleep") {
      await apiFetch("/me/daily", {
        method: "PATCH",
        body: JSON.stringify({ sleepHours: clean }),
      });
    } else {
      return { ok: false, error: "Unknown stat type." };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function getMacros() {
  // Backend computes macros on POST /me/test but doesn't store them or
  // expose a GET endpoint. Returns zeroed goals until that exists.
  return [
    { label: "calories", value: 0, goal: 2100, unit: "kcal" },
    { label: "protein", value: 0, goal: 140, unit: "g" },
    { label: "carbs", value: 0, goal: 220, unit: "g" },
    { label: "fat", value: 0, goal: 65, unit: "g" },
  ];
}

export function getQuote() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - start) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}

// Kept for backward compat. getHomeData uses the server's streak now.
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
  const [user, stats, macros, streakData] = await Promise.all([
    getUser(),
    getTodayStats(),
    getMacros(),
    apiFetch("/me/streak?days=14"),
  ]);

  const week = buildWeekFromStreak(streakData.days);
  const today = todayIndex();
  const streak = streakData.currentStreak ?? 0;

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
