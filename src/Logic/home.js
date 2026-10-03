import { QUOTES } from "../constants/quotes";
import { apiFetch } from "./api";

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

function buildWeekFromStreak(days) {
  const byDate = new Map(days.map((d) => [d.date, d.status]));
  const week = Array(7).fill(false);
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - todayIndex());
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    week[i] = byDate.get(toISO(d)) === "completed";
  }
  return week;
}

export async function getWeek() {
  try {
    const data = await apiFetch("/me/streak?days=14");
    return buildWeekFromStreak(data.days);
  } catch {
    return Array(7).fill(false);
  }
}

export async function getTodayStats() {
  try {
    const me = await apiFetch("/me");
    const today = me.today || {};
    return {
      sleep: { value: today.sleepHours ?? 0, goal: 8, unit: "h" },
      water: {
        value: Math.round(((today.waterMl ?? 0) / 1000) * 100) / 100,
        goal: 2.5,
        unit: "L",
      },
    };
  } catch {
    return {
      sleep: { value: 0, goal: 8, unit: "h" },
      water: { value: 0, goal: 2.5, unit: "L" },
    };
  }
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

// --- macros / food log ------------------------------------------------

export async function getMacros() {
  try {
    const data = await apiFetch("/me/food");
    const c = data.consumed;
    const g = data.goal || { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    return [
      { label: "calories", value: c.calories, goal: g.calories, unit: "kcal" },
      { label: "protein", value: c.protein_g, goal: g.protein_g, unit: "g" },
      { label: "carbs", value: c.carbs_g, goal: g.carbs_g, unit: "g" },
      { label: "fat", value: c.fat_g, goal: g.fat_g, unit: "g" },
    ];
  } catch {
    return [
      { label: "calories", value: 0, goal: 0, unit: "kcal" },
      { label: "protein", value: 0, goal: 0, unit: "g" },
      { label: "carbs", value: 0, goal: 0, unit: "g" },
      { label: "fat", value: 0, goal: 0, unit: "g" },
    ];
  }
}

// Increment today's macros. Pass any subset:
//   saveMeal({ calories: 500 })
//   saveMeal({ protein_g: 30, carbs_g: 40 })
export async function saveMeal(input) {
  try {
    const body = {};
    if (input.calories != null) body.calories = Math.round(input.calories);
    if (input.protein_g != null) body.protein_g = Math.round(input.protein_g);
    if (input.carbs_g != null) body.carbs_g = Math.round(input.carbs_g);
    if (input.fat_g != null) body.fat_g = Math.round(input.fat_g);
    if (Object.keys(body).length === 0) {
      return { ok: false, error: "Nothing to add." };
    }
    const data = await apiFetch("/me/food", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { ok: true, consumed: data.consumed };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// --- quotes + streak helpers ------------------------------------------

export function getQuote() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - start) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}

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
  const [user, week, stats, macros, streakData] = await Promise.all([
    getUser().catch(() => ({ name: "" })),
    getWeek(),
    getTodayStats(),
    getMacros(),
    apiFetch("/me/streak?days=14").catch(() => ({ currentStreak: 0 })),
  ]);

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
