// BMI + body-composition category, straight from Maria's rules.

function calculateBMI(heightCm, weightKg) {
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

function bmiGroup(bmi) {
  if (bmi < 18.5) return "Low BMI (Under 18.5)";
  if (bmi < 25.0) return "Moderate BMI (18.5 to 24.9)";
  return "High BMI (25.0 and Above)";
}

/**
 * @param {{weightTraining:'Low'|'Moderate'|'High', jobType:string, bmiGroup:string, cardioHistory:'Low'|'Moderate'|'High'}} p
 * @returns {'Muscular'|'Normal'|'Skinny Fat'|'Fat'}
 */
function categorize({ weightTraining, jobType, bmiGroup, cardioHistory }) {
  if (weightTraining === "High") {
    return "Muscular";
  }
  if (
    weightTraining === "Moderate" ||
    ["Active", "Heavy Physical"].includes(jobType)
  ) {
    return bmiGroup === "Low BMI (Under 18.5)" ? "Muscular" : "Normal";
  }
  // Weight Training === 'Low' AND Job Type in (Sedentary, Light Movement)
  if (bmiGroup === "High BMI (25.0 and Above)") return "Fat";
  if (bmiGroup === "Moderate BMI (18.5 to 24.9)") return "Skinny Fat";
  // Low BMI
  return cardioHistory === "Low" ? "Normal" : "Skinny Fat";
}

function classify({
  heightCm,
  weightKg,
  jobType,
  weightTraining,
  cardioHistory,
}) {
  const bmi = calculateBMI(heightCm, weightKg);
  const bmiGrp = bmiGroup(bmi);
  const category = categorize({
    weightTraining,
    jobType,
    bmiGroup: bmiGrp,
    cardioHistory,
  });
  return { bmi, bmiGroup: bmiGrp, category };
}

module.exports = { calculateBMI, bmiGroup, categorize, classify };
