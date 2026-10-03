function ageFromBirthDate(birthDate, now = new Date()) {
  if (birthDate == null) return null;

  let y, m, d;

  if (typeof birthDate === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate);
    if (!match) return null;
    y = Number(match[1]);
    m = Number(match[2]) - 1;
    d = Number(match[3]);
  } else if (birthDate instanceof Date) {
    if (Number.isNaN(birthDate.getTime())) return null;
    y = birthDate.getUTCFullYear();
    m = birthDate.getUTCMonth();
    d = birthDate.getUTCDate();
  } else {
    // Numbers, booleans, objects, arrays, functions, undefined-non-null — all rejected.
    return null;
  }

  let age = now.getFullYear() - y;
  const monthDiff = now.getMonth() - m;
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d)) {
    age -= 1;
  }
  return age;
}
module.exports = { ageFromBirthDate };
