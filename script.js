const fields = {
  age: document.getElementById("age"),
  height: document.getElementById("height"),
  weight: document.getElementById("weight"),
  smokes: document.getElementById("smokes"),
  cigarettes: document.getElementById("cigarettes"),
  drinkingFrequency: document.getElementById("drinking-frequency"),
  alcoholType: document.getElementById("alcohol-type"),
  alcoholProof: document.getElementById("alcohol-proof"),
  alcoholVolume: document.getElementById("alcohol-volume"),
  exerciseFrequency: document.getElementById("exercise-frequency"),
  exerciseIntensity: document.getElementById("exercise-intensity"),
  exerciseType: document.getElementById("exercise-type"),
  exerciseDuration: document.getElementById("exercise-duration"),
};

const outputs = {
  bmi: document.getElementById("bmi"),
  alcoholTypeHint: document.getElementById("alcohol-type-hint"),
  daysLeft: document.getElementById("days-left"),
  estimatedLife: document.getElementById("estimated-life"),
  healthScore: document.getElementById("health-score"),
  currentAge: document.getElementById("current-age"),
  insights: document.getElementById("insights"),
  formulaSummary: document.getElementById("formula-summary"),
};

const cigarettesField = document.getElementById("cigarettes-field");

const alcoholProfiles = {
  beer: {
    factor: 0.95,
    proof: 4.5,
    label: "맥주",
    hint: "맥주는 일반 라거 기준 4.5도로 계산해요.",
  },
  soju: {
    factor: 1.1,
    proof: 13,
    label: "소주",
    hint: "소주는 일반 희석식 소주 기준 13도로 계산해요.",
  },
  wine: {
    factor: 0.85,
    proof: 12,
    label: "와인",
    hint: "와인은 일반 레드 와인 기준 12도로 계산해요.",
  },
  whiskey: {
    factor: 1.15,
    proof: 40,
    label: "위스키·증류주",
    hint: "위스키·증류주는 일반 위스키 기준 40도로 계산해요.",
  },
  mixed: {
    factor: 1,
    proof: 7,
    label: "혼합주·기타",
    hint: "혼합주·기타는 캔 하이볼 기준 7도로 계산해요.",
  },
};

const exerciseIntensityBonus = {
  light: 0.6,
  moderate: 1.2,
  high: 1.5,
};

const exerciseTypeBonus = {
  none: 0,
  cardio: 1.2,
  weights: 1,
  mixed: 1.5,
};

const exerciseIntensityLabel = {
  light: "가벼운",
  moderate: "중간",
  high: "높은",
};

const exerciseTypeLabel = {
  none: "운동 없음",
  cardio: "유산소",
  weights: "웨이트",
  mixed: "혼합 운동",
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toNumber(input, fallback = 0) {
  const value = Number.parseFloat(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function calculateBmi(heightCm, weightKg) {
  if (heightCm <= 0 || weightKg <= 0) {
    return 0;
  }

  const heightMeter = heightCm / 100;
  return weightKg / (heightMeter * heightMeter);
}

function calculateLifeExpectancy(data) {
  let expectancy = 83;
  const insights = [];

  const bmiGap = Math.abs(data.bmi - 22);
  const bmiPenalty = bmiGap <= 2 ? 0 : Math.min(10, (bmiGap - 2) * 0.9);
  expectancy -= bmiPenalty;
  if (bmiPenalty > 0) {
    insights.push(`BMI가 권장 범위(22 전후)와 차이가 있어 약 ${bmiPenalty.toFixed(1)}년 낮게 반영했어요.`);
  } else {
    insights.push("BMI가 권장 범위에 가까워 체중 요인은 거의 반영되지 않았어요.");
  }

  if (data.smokes === "yes" && data.cigarettes > 0) {
    const smokingPenalty = clamp(data.cigarettes * 0.22, 0, 15);
    expectancy -= smokingPenalty;
    insights.push(`하루 ${data.cigarettes}개비 흡연을 반영해 약 ${smokingPenalty.toFixed(1)}년 낮게 계산했어요.`);
  } else {
    insights.push("비흡연으로 계산해 흡연 요인은 반영되지 않았어요.");
  }

  const pureAlcoholMlPerWeek =
    data.drinkingFrequency *
    data.alcoholVolume *
    (data.alcoholProof / 100) *
    alcoholProfiles[data.alcoholType].factor;
  const alcoholPenalty = pureAlcoholMlPerWeek <= 120
    ? 0
    : clamp((pureAlcoholMlPerWeek - 120) / 120, 0, 8);
  expectancy -= alcoholPenalty;
  if (alcoholPenalty > 0) {
    insights.push(`음주 습관을 반영해 약 ${alcoholPenalty.toFixed(1)}년 낮게 계산했어요.`);
  } else {
    insights.push("음주량이 적은 편이라 음주 요인은 거의 반영되지 않았어요.");
  }

  const weeklyExerciseMinutes = data.exerciseFrequency * data.exerciseDuration;
  const exerciseBonus =
    data.exerciseFrequency === 0 || data.exerciseType === "none"
      ? 0
      : clamp(
          weeklyExerciseMinutes / 90 +
            exerciseIntensityBonus[data.exerciseIntensity] +
            exerciseTypeBonus[data.exerciseType],
          0,
          6
        );
  expectancy += exerciseBonus;
  if (exerciseBonus > 0) {
    insights.push(`꾸준한 운동 습관을 반영해 약 ${exerciseBonus.toFixed(1)}년 높게 계산했어요.`);
  } else {
    insights.push("운동 기록이 없어 운동 요인은 반영되지 않았어요.");
  }

  const ageAdjustment = data.age >= 75 ? -2 : data.age >= 60 ? -1 : data.age < 30 ? 1 : 0;
  expectancy += ageAdjustment;
  if (ageAdjustment > 0) {
    insights.push("연령대를 고려해 소폭 높게 보정했어요.");
  } else if (ageAdjustment < 0) {
    insights.push("연령대를 고려해 소폭 낮게 보정했어요.");
  }

  expectancy = clamp(expectancy, 45, 102);
  return { expectancy, insights, pureAlcoholMlPerWeek, weeklyExerciseMinutes };
}

function buildSummary(data, metrics) {
  const smokeText =
    data.smokes === "yes" && data.cigarettes > 0 ? `${data.cigarettes}개비/일 흡연` : "비흡연";
  const drinkText =
    data.drinkingFrequency > 0
      ? `주 ${data.drinkingFrequency}회, ${alcoholProfiles[data.alcoholType].label}, 도수 ${data.alcoholProof}%, 1회 ${data.alcoholVolume}ml`
      : "음주 없음";
  const exerciseText =
    data.exerciseFrequency > 0 && data.exerciseType !== "none"
      ? `주 ${data.exerciseFrequency}회 ${exerciseTypeLabel[data.exerciseType]}, ${exerciseIntensityLabel[data.exerciseIntensity]} 강도, 회당 ${data.exerciseDuration}분`
      : "운동 없음";

  return `평균 기대수명 83세를 기준으로 키 ${data.height}cm, 몸무게 ${data.weight}kg에서 계산된 BMI(${data.bmi.toFixed(1)}), ${smokeText}, ${drinkText}, ${exerciseText}를 반영했어요. 순수 알코올 섭취량은 주 ${metrics.pureAlcoholMlPerWeek.toFixed(0)}ml, 총 운동 시간은 주 ${metrics.weeklyExerciseMinutes.toFixed(0)}분으로 환산해 보정했어요.`;
}

function calculateHealthScore(data, expectancy) {
  let score = 78;
  const exercises =
    data.exerciseFrequency > 0 && data.exerciseType !== "none" && data.exerciseDuration > 0;
  score -= Math.abs(data.bmi - 22) * 1.8;
  score -= data.smokes === "yes" ? data.cigarettes * 1.3 : 0;
  score -= data.drinkingFrequency * (data.alcoholProof / 12) * (data.alcoholVolume / 180) * 2.4;
  score += exercises ? data.exerciseFrequency * 2.4 : 0;
  score += exercises ? data.exerciseDuration / 18 : 0;
  score += exercises ? exerciseIntensityBonus[data.exerciseIntensity] * 3 : 0;
  score += exercises ? exerciseTypeBonus[data.exerciseType] * 2 : 0;
  score += (expectancy - 83) * 1.7;
  return Math.round(clamp(score, 5, 100));
}

function readData() {
  const smokes = fields.smokes.value;
  const cigarettes = smokes === "yes" ? toNumber(fields.cigarettes) : 0;
  const height = clamp(toNumber(fields.height, 170), 80, 250);
  const weight = clamp(toNumber(fields.weight, 65), 20, 300);
  const bmi = clamp(calculateBmi(height, weight), 10, 60);
  const alcoholProfile = alcoholProfiles[fields.alcoholType.value];

  return {
    age: clamp(toNumber(fields.age, 35), 1, 120),
    height,
    weight,
    bmi,
    smokes,
    cigarettes: clamp(cigarettes, 0, 80),
    drinkingFrequency: clamp(toNumber(fields.drinkingFrequency, 0), 0, 14),
    alcoholType: fields.alcoholType.value,
    alcoholProof: alcoholProfile.proof,
    alcoholVolume: clamp(toNumber(fields.alcoholVolume, 0), 0, 3000),
    exerciseFrequency: clamp(toNumber(fields.exerciseFrequency, 0), 0, 14),
    exerciseIntensity: fields.exerciseIntensity.value,
    exerciseType: fields.exerciseType.value,
    exerciseDuration: clamp(toNumber(fields.exerciseDuration, 0), 0, 300),
  };
}

function render() {
  const data = readData();
  const metrics = calculateLifeExpectancy(data);
  const yearsLeft = Math.max(metrics.expectancy - data.age, 0);
  const daysLeft = Math.round(yearsLeft * 365.25);
  const healthScore = calculateHealthScore(data, metrics.expectancy);
  const alcoholHint = alcoholProfiles[data.alcoholType].hint;

  outputs.bmi.textContent = data.bmi.toFixed(1);
  fields.alcoholProof.textContent = data.alcoholProof.toFixed(1).replace(".0", "");
  outputs.alcoholTypeHint.textContent = alcoholHint;
  outputs.daysLeft.textContent = daysLeft.toLocaleString("ko-KR");
  outputs.estimatedLife.textContent = metrics.expectancy.toFixed(1);
  outputs.healthScore.textContent = `${healthScore} / 100`;
  outputs.currentAge.textContent = `${data.age.toFixed(0)}세`;
  outputs.formulaSummary.textContent = buildSummary(data, metrics);

  outputs.insights.innerHTML = "";
  metrics.insights.forEach((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    outputs.insights.appendChild(item);
  });

  cigarettesField.hidden = data.smokes !== "yes";
  if (data.smokes !== "yes") {
    fields.cigarettes.value = "0";
  }
}

Object.values(fields).forEach((field) => {
  field.addEventListener("input", render);
  field.addEventListener("change", render);
});

render();
