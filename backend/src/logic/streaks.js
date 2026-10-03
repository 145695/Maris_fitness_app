// Streak computation. Pure functions — takes a plan doc + a Map of workout
// logs keyed by YYYY-MM-DD and returns per-day statuses plus streak counts.
//
// A "streak" is a run of consecutive *completed training days*. Rest days
// are transparent: they neither extend nor break the streak. A past training
// day that wasn't completed breaks the streak. Today's training day, if not
// yet completed, is "pending" — it doesn't break the streak either, because
// the day isn't over.
//
// Statuses a day can have:
//   completed   - training day, log exists, isWorkoutComplete returned true
//   missed      - training day strictly before today, not completed
//   pending     - training day, is today, not completed
//   rest        - plan says rest
//   out_of_plan - outside the plan's started_at / ends_at window
//
// 'currentStreak' and 'longestStreak' are computed *within the requested
// window only*. A user on a 60-day run who asks for 7 days sees 7.

const { planDayFor } = require("./planDays");
const { flattenDayExercises, isWorkoutComplete } = require("./workoutLogs");
const { addDays } = require("../utils/dates");

function statusForDay({ date, todayIso, day, log }) {
  const done = log?.exercises_done ?? 0;
  const total = log?.exercises_total ?? flattenDayExercises(day.exercises).length;
  const complete = log ? isWorkoutComplete(done, total) : false;

  if (day.isRest) return { status: "rest", done, total };
  if (date > todayIso) return { status: "future", done, total };
  if (date === todayIso) {
    return { status: complete ? "completed" : "pending", done, total };
  }
  return { status: complete ? "completed" : "missed", done, total };
}

// Build the day-by-day view of the last `days` days, ending today.
function computeDayStatuses(planDoc, logsByDate, todayIso, days) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(todayIso, -i);
    const day = planDayFor(planDoc, date);

    if (!day) {
      out.push({
        date,
        dayNumber: null,
        weekNumber: null,
        isRest: null,
        status: "out_of_plan",
        exercisesDone: 0,
        exercisesTotal: 0,
      });
      continue;
    }

    const log = logsByDate.get(date);
    const { status, done, total } = statusForDay({ date, todayIso, day, log });

    out.push({
      date,
      dayNumber: day.dayNumber,
      weekNumber: day.weekNumber,
      isRest: day.isRest,
      status,
      exercisesDone: done,
      exercisesTotal: total,
    });
  }
  return out;
}

// Walk backwards from the last entry (today). 'completed' counts, 'missed'
// stops the walk, everything else is transparent.
function computeCurrentStreak(statuses) {
  let streak = 0;
  let stopped = false;
  for (let i = statuses.length - 1; i >= 0; i--) {
    const s = statuses[i].status;
    if (s === "completed") streak++;
    else if (s === "missed") {
      stopped = true;
      break;
    }
    // rest / pending / future / out_of_plan: skip
  }
  return streak;
}

// Forward pass across the window. Same rules.
function computeLongestStreak(statuses) {
  let max = 0;
  let curr = 0;
  for (const d of statuses) {
    if (d.status === "completed") {
      curr++;
      if (curr > max) max = curr;
    } else if (d.status === "missed") {
      curr = 0;
    }
  }
  return max;
}

module.exports = {
  computeDayStatuses,
  computeCurrentStreak,
  computeLongestStreak,
};