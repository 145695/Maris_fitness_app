import { apiFetch } from "./api";

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DEFAULT_ROUNDS = 3;

let state = {
  date: null,
  exercises: [],
  completedIds: new Set(),
};

function toClientExercise(ex, isDone) {
  return {
    id: ex.exercise_id,
    name: ex.name,
    reps: ex.reps ?? 0,
    rounds: DEFAULT_ROUNDS,
    done: isDone ? DEFAULT_ROUNDS : 0,
  };
}

export async function getWorkout() {
  const date = todayISO();
  try {
    const data = await apiFetch(`/me/workouts/${date}`);

    if (data.isRest) {
      state = { date, exercises: [], completedIds: new Set() };
      return [];
    }

    const exercises = Object.values(data.exercises || {}).flat();
    const completedIds = new Set(data.log?.completedExerciseIds || []);

    state = { date, exercises, completedIds };

    return exercises.map((ex) =>
      toClientExercise(ex, completedIds.has(ex.exercise_id)),
    );
  } catch (err) {
    // No active plan yet — user hasn't completed the test. Return empty
    // instead of crashing. The screen should route to onboarding.
    if (err.status === 409) {
      state = { date, exercises: [], completedIds: new Set() };
      return [];
    }
    throw err;
  }
}
export async function saveProgress(exerciseId, done) {
  if (!state.date) {
    await getWorkout();
  }

  const isNowDone = done >= DEFAULT_ROUNDS;
  if (isNowDone) state.completedIds.add(exerciseId);
  else state.completedIds.delete(exerciseId);

  try {
    const res = await apiFetch(`/me/workouts/${state.date}`, {
      method: "PUT",
      body: JSON.stringify({
        completedExerciseIds: Array.from(state.completedIds),
      }),
    });
    return { ok: true, allDone: !!res.log?.completed };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export function isFinished(exercise) {
  return exercise.done >= exercise.rounds;
}

export function workoutProgress(exercises) {
  const total = exercises.reduce((s, e) => s + e.rounds, 0);
  const done = exercises.reduce((s, e) => s + e.done, 0);
  return total === 0 ? 0 : done / total;
}
