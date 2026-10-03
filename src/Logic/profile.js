import { apiFetch } from "./api";

function ageToBirthDate(age) {
  const year = new Date().getFullYear() - age;
  return `${year}-01-01`;
}

// "light movement" -> "Light Movement", "high" -> "High"
function titleCase(s) {
  return String(s).replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function saveProfile(answers) {
  const age = Number(answers.age);
  if (!Number.isFinite(age) || age < 13 || age > 100) {
    return { ok: false, error: "age must be between 13 and 100" };
  }

  const payload = {
    birthDate: ageToBirthDate(age),
    heightCm: Number(answers.height),
    weightKg: Number(answers.weight),
    jobType: titleCase(answers.job),
    weightTraining: titleCase(answers.weightTraining),
    cardioHistory: titleCase(answers.cardio),
    availabilityHoursPerDay: Number(answers.availability),
    healthIssueCount: Number(answers.healthIssues),
    goalId: answers.goal,
    gender: String(answers.gender).toLowerCase(),
  };

  console.log("[profile] POST /me/test", payload);

  try {
    const data = await apiFetch("/me/test", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    console.log("[profile] success, plan:", data.plan?.name);
    return { ok: true, plan: data.plan, macros: data.macros };
  } catch (err) {
    console.log("[profile] failed:", err.status, err.message);
    return { ok: false, error: err.message, status: err.status };
  }
}
