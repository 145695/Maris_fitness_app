// Rough estimate only - not medical advice. Standard formulas, standard assumptions.

const MUSCLE_BUILDING_GOALS = new Set([
  "Muscle",
  "Body Transformation",
  "Fat Loss",
]);

function bmr({ weightKg, heightCm, age, gender }) {
  // Mifflin-St Jeor
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === "male" ? base + 5 : base - 161;
}

function activityMultiplier(daysPerWeek) {
  if (daysPerWeek <= 1) return 1.2;
  if (daysPerWeek <= 3) return 1.375;
  if (daysPerWeek <= 5) return 1.55;
  return 1.725;
}

function calorieTarget(tdee, goalType) {
  if (goalType === "Fat Loss") return tdee * 0.8; // ~20% deficit
  if (goalType === "Muscle" || goalType === "Body Transformation")
    return tdee * 1.12; // ~12% surplus
  return tdee; // maintenance for Endurance, Posture, Flexibility, Health, Habits, Mobility
}

function calculateMacros({
  weightKg,
  heightCm,
  age,
  gender,
  daysPerWeek,
  goalType,
}) {
  const bmrValue = bmr({ weightKg, heightCm, age, gender });
  const tdee = bmrValue * activityMultiplier(daysPerWeek);
  const calories = calorieTarget(tdee, goalType);

  const proteinPerKg = MUSCLE_BUILDING_GOALS.has(goalType) ? 2.0 : 1.6;
  const proteinG = proteinPerKg * weightKg;
  const fatG = (calories * 0.25) / 9;
  const remaining = calories - (proteinG * 4 + fatG * 9);
  const carbsG = Math.max(0, remaining / 4);

  return {
    bmr: Math.round(bmrValue),
    tdee: Math.round(tdee),
    calories: Math.round(calories),
    protein_g: Math.round(proteinG),
    fat_g: Math.round(fatG),
    carbs_g: Math.round(carbsG),
  };
}

module.exports = { bmr, activityMultiplier, calorieTarget, calculateMacros };
