const wait = (ms = 600) => new Promise((resolve) => setTimeout(resolve, ms));

// answers comes from the onboarding screen (everything is a string / array of strings)
const RANGES = {
  weightKg: [20, 300],
  heightCm: [100, 250],
  age: [13, 100],
  availabilityHours: [0.5, 8],
  healthIssues: [0, 20],
};

function validate(payload) {
  for (const [key, [min, max]] of Object.entries(RANGES)) {
    const n = payload[key];
    if (!Number.isFinite(n) || n < min || n > max) {
      return `${key} must be between ${min} and ${max}`;
    }
  }
  return null;
}
export async function saveProfile(answers) {
  const payload = {
    weightKg: Number(answers.weight),
    heightCm: Number(answers.height),
    age: Number(answers.age),
    gender: answers.gender,
    jobType: answers.job,
    availabilityHours: Number(answers.availability),
    activities: answers.activities, // ["indoor", "gaming"]
    weightTraining: answers.weightTraining,
    cardio: answers.cardio,
    healthIssues: Number(answers.healthIssues),
    goalId: answers.goal, // "G03"
  };
  const problem = validate(payload);
  if (problem) return { ok: false, error: problem };
  await wait();
  // TODO: POST payload to your Node API (e.g. /profile)
  console.log("profile", payload);
  return { ok: true };
}
