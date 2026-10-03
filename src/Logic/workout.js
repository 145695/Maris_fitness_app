const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

// Fake data. Replace the bodies with API calls later.
// "done" = rounds he already finished today.
let today = [
  { id: "e1", name: "squats", reps: 12, rounds: 3, done: 0 },
  { id: "e2", name: "push ups", reps: 12, rounds: 3, done: 0 },
  { id: "e3", name: "lunges", reps: 12, rounds: 3, done: 0 },
  { id: "e4", name: "plank rows", reps: 12, rounds: 3, done: 0 },
];

export async function getWorkout() {
  await wait();
  // TODO: GET /workout/today (from the plan generator)
  return today.map((e) => ({ ...e }));
}

// Saves how many rounds of one exercise are finished.
// Returns allDone = true when the whole workout is finished.
export async function saveProgress(exerciseId, done) {
  today = today.map((e) =>
    e.id === exerciseId
      ? { ...e, done: Math.max(0, Math.min(e.rounds, done)) }
      : e,
  );
  // TODO: PATCH /workout/today/:exerciseId { done }
  const allDone = today.every((e) => e.done >= e.rounds);
  // TODO: when allDone, the server marks today's star on the home week
  return { ok: true, allDone };
}

// pure helpers
export function isFinished(exercise) {
  return exercise.done >= exercise.rounds;
}

export function workoutProgress(exercises) {
  const total = exercises.reduce((s, e) => s + e.rounds, 0);
  const done = exercises.reduce((s, e) => s + e.done, 0);
  return total === 0 ? 0 : done / total;
}
