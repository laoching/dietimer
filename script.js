import { Analytics, Notification, Review, Storage } from "@apps-in-toss/web-framework";

const fields = {
  age: document.getElementById("age"),
  height: document.getElementById("height"),
  weight: document.getElementById("weight"),
  smokes: document.getElementById("smokes"),
  cigarettes: document.getElementById("cigarettes"),
  drinkingFrequency: document.getElementById("drinking-frequency"),
  alcoholType: document.getElementById("alcohol-type"),
  alcoholVolume: document.getElementById("alcohol-volume"),
  exerciseFrequency: document.getElementById("exercise-frequency"),
  exerciseIntensity: document.getElementById("exercise-intensity"),
  exerciseType: document.getElementById("exercise-type"),
  exerciseDuration: document.getElementById("exercise-duration"),
};

const requiredFields = [
  { input: fields.age, label: "나이" },
  { input: fields.height, label: "키" },
  { input: fields.weight, label: "몸무게" },
];

const outputs = {
  bmi: document.getElementById("bmi"),
  alcoholProof: document.getElementById("alcohol-proof"),
  alcoholTypeHint: document.getElementById("alcohol-type-hint"),
  daysLeft: document.getElementById("days-left"),
  estimatedLife: document.getElementById("estimated-life"),
  resultCompare: document.getElementById("result-compare"),
  resultDone: document.getElementById("result-done"),
  resultHistory: document.getElementById("result-history"),
  healthScore: document.getElementById("health-score"),
  scoreGrade: document.getElementById("score-grade"),
  scoreBar: document.getElementById("score-bar"),
  scoreDesc: document.getElementById("score-desc"),
  currentAge: document.getElementById("current-age"),
  insights: document.getElementById("insights"),
  formulaSummary: document.getElementById("formula-summary"),
};

const form = document.getElementById("life-form");
const formError = document.getElementById("form-error");
const result = document.getElementById("result");
const resultCard = document.getElementById("result-card");
const editButton = document.getElementById("edit-button");
const reminderCard = document.getElementById("reminder-card");
const reminderButton = document.getElementById("reminder-button");
const reminderStatus = document.getElementById("reminder-status");
const cigarettesField = document.getElementById("cigarettes-field");
const drinkDetails = document.querySelectorAll("[data-drink-detail]");
const exerciseDetails = document.querySelectorAll("[data-exercise-detail]");

const STORAGE_KEY = "dietimer:last";
const REMINDER_STORAGE_KEY = "dietimer:reminder";
// 콘솔 스마트발송 템플릿 코드예요. 비어 있으면 알림 카드를 보여주지 않아요.
const NOTIFICATION_TEMPLATE_CODE = "";
const BASE_EXPECTANCY = 83;

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
  cardio: "유산소",
  weights: "웨이트",
  mixed: "혼합 운동",
};

const scoreGrades = [
  { min: 80, label: "아주 좋음", desc: "기대수명에 유리한 습관을 잘 유지하고 있어요." },
  { min: 60, label: "좋음", desc: "전반적으로 괜찮아요. 아래에서 낮게 반영된 요인을 확인해 보세요." },
  { min: 40, label: "보통", desc: "개선하면 기대수명이 늘어날 수 있는 습관이 있어요." },
  { min: 0, label: "개선 필요", desc: "아래에서 기대수명을 가장 많이 낮춘 요인부터 바꿔보세요." },
];

const state = {
  hasResult: false,
  previous: null,
  completions: 0,
  reviewRequested: false,
  reminderAgreed: false,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toNumber(input, fallback = 0) {
  const value = Number.parseFloat(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function formatYears(value) {
  return `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(value).toFixed(1)}년`;
}

function calculateBmi(heightCm, weightKg) {
  if (heightCm <= 0 || weightKg <= 0) {
    return 0;
  }

  const heightMeter = heightCm / 100;
  return weightKg / (heightMeter * heightMeter);
}

function calculateLifeExpectancy(data) {
  let expectancy = BASE_EXPECTANCY;
  const insights = [];

  const bmiGap = Math.abs(data.bmi - 22);
  const bmiPenalty = bmiGap <= 2 ? 0 : Math.min(10, (bmiGap - 2) * 0.9);
  expectancy -= bmiPenalty;
  insights.push({
    label: "체중(BMI)",
    delta: -bmiPenalty,
    text:
      bmiPenalty > 0
        ? `BMI ${data.bmi.toFixed(1)}이 권장 범위(20~24)를 벗어나 낮게 반영했어요.`
        : `BMI ${data.bmi.toFixed(1)}이 권장 범위(20~24) 안이라 영향이 없어요.`,
  });

  if (data.smokes === "yes" && data.cigarettes > 0) {
    const smokingPenalty = clamp(data.cigarettes * 0.22, 0, 15);
    expectancy -= smokingPenalty;
    insights.push({
      label: "흡연",
      delta: -smokingPenalty,
      text: `하루 ${data.cigarettes}개비 흡연을 반영했어요. 흡연량이 많을수록 더 낮아져요.`,
    });
  } else {
    insights.push({ label: "흡연", delta: 0, text: "비흡연이라 영향이 없어요." });
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
  insights.push({
    label: "음주",
    delta: -alcoholPenalty,
    text:
      alcoholPenalty > 0
        ? `주당 순수 알코올 ${pureAlcoholMlPerWeek.toFixed(0)}ml로 기준(120ml)을 넘어 낮게 반영했어요.`
        : `주당 순수 알코올 ${pureAlcoholMlPerWeek.toFixed(0)}ml로 기준(120ml) 이하라 영향이 없어요.`,
  });

  const weeklyExerciseMinutes = data.exerciseFrequency * data.exerciseDuration;
  const exerciseBonus =
    data.exerciseFrequency === 0 || data.exerciseDuration === 0
      ? 0
      : clamp(
          weeklyExerciseMinutes / 90 +
            exerciseIntensityBonus[data.exerciseIntensity] +
            exerciseTypeBonus[data.exerciseType],
          0,
          6
        );
  expectancy += exerciseBonus;
  insights.push({
    label: "운동",
    delta: exerciseBonus,
    text:
      exerciseBonus > 0
        ? `주 ${weeklyExerciseMinutes.toFixed(0)}분 운동을 반영했어요. 시간·강도가 늘수록 더 높아져요(최대 +6년).`
        : "운동 기록이 없어 반영하지 않았어요. 운동을 추가하면 기대수명이 높아져요.",
  });

  const ageAdjustment = data.age >= 75 ? -2 : data.age >= 60 ? -1 : data.age < 30 ? 1 : 0;
  expectancy += ageAdjustment;
  if (ageAdjustment !== 0) {
    insights.push({
      label: "연령대",
      delta: ageAdjustment,
      text: "연령대별 통계 경향을 고려해 소폭 보정했어요.",
    });
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
    data.exerciseFrequency > 0 && data.exerciseDuration > 0
      ? `주 ${data.exerciseFrequency}회 ${exerciseTypeLabel[data.exerciseType]}, ${exerciseIntensityLabel[data.exerciseIntensity]} 강도, 회당 ${data.exerciseDuration}분`
      : "운동 없음";

  return `평균 기대수명 ${BASE_EXPECTANCY}세를 기준으로 키 ${data.height}cm, 몸무게 ${data.weight}kg에서 계산된 BMI(${data.bmi.toFixed(1)}), ${smokeText}, ${drinkText}, ${exerciseText}를 반영했어요. 순수 알코올 섭취량은 주 ${metrics.pureAlcoholMlPerWeek.toFixed(0)}ml, 총 운동 시간은 주 ${metrics.weeklyExerciseMinutes.toFixed(0)}분으로 환산해 보정했어요. 생활습관 점수는 같은 요인을 100점 만점으로 환산한 값으로, 높을수록 기대수명에 유리한 습관이에요.`;
}

function calculateHealthScore(data, expectancy) {
  let score = 78;
  const exercises = data.exerciseFrequency > 0 && data.exerciseDuration > 0;
  score -= Math.abs(data.bmi - 22) * 1.8;
  score -= data.smokes === "yes" ? data.cigarettes * 1.3 : 0;
  score -= data.drinkingFrequency * (data.alcoholProof / 12) * (data.alcoholVolume / 180) * 2.4;
  score += exercises ? data.exerciseFrequency * 2.4 : 0;
  score += exercises ? data.exerciseDuration / 18 : 0;
  score += exercises ? exerciseIntensityBonus[data.exerciseIntensity] * 3 : 0;
  score += exercises ? exerciseTypeBonus[data.exerciseType] * 2 : 0;
  score += (expectancy - BASE_EXPECTANCY) * 1.7;
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

function validate() {
  const invalid = requiredFields.filter(({ input }) => {
    const value = Number.parseFloat(input.value);
    const valid =
      Number.isFinite(value) && value >= Number(input.min) && value <= Number(input.max);
    input.toggleAttribute("aria-invalid", !valid);
    return !valid;
  });

  if (invalid.length === 0) {
    formError.hidden = true;
    return true;
  }

  formError.textContent = `${invalid.map(({ label }) => label).join(", ")} 값을 올바르게 입력해 주세요.`;
  formError.hidden = false;
  invalid[0].input.focus();
  return false;
}

// 입력 단계에서 바로 보여줄 수 있는 값(BMI, 도수, 조건부 입력칸)을 갱신해요.
function renderInputs() {
  const smokes = fields.smokes.value === "yes";
  const drinks = toNumber(fields.drinkingFrequency) > 0;
  const exercises = toNumber(fields.exerciseFrequency) > 0;
  const alcoholProfile = alcoholProfiles[fields.alcoholType.value];

  cigarettesField.hidden = !smokes;
  drinkDetails.forEach((element) => {
    element.hidden = !drinks;
  });
  exerciseDetails.forEach((element) => {
    element.hidden = !exercises;
  });

  const height = toNumber(fields.height);
  const weight = toNumber(fields.weight);
  outputs.bmi.textContent =
    height > 0 && weight > 0 ? calculateBmi(height, weight).toFixed(1) : "-";
  outputs.alcoholProof.textContent = alcoholProfile.proof.toFixed(1).replace(".0", "");
  outputs.alcoholTypeHint.textContent = alcoholProfile.hint;
}

function renderResult() {
  const data = readData();
  const metrics = calculateLifeExpectancy(data);
  const yearsLeft = Math.max(metrics.expectancy - data.age, 0);
  const daysLeft = Math.round(yearsLeft * 365.25);
  const healthScore = calculateHealthScore(data, metrics.expectancy);
  const grade = scoreGrades.find(({ min }) => healthScore >= min);
  const baseGap = metrics.expectancy - BASE_EXPECTANCY;

  outputs.estimatedLife.textContent = metrics.expectancy.toFixed(1);
  outputs.resultCompare.textContent =
    Math.abs(baseGap) < 0.05
      ? `평균 기대수명(${BASE_EXPECTANCY}세)과 같아요`
      : `평균 기대수명(${BASE_EXPECTANCY}세)보다 ${Math.abs(baseGap).toFixed(1)}년 ${baseGap > 0 ? "길어요" : "짧아요"}`;
  outputs.resultCompare.dataset.tone = baseGap >= 0 ? "up" : "down";
  outputs.daysLeft.textContent = daysLeft.toLocaleString("ko-KR");
  outputs.currentAge.textContent = data.age.toFixed(0);

  outputs.healthScore.textContent = healthScore;
  outputs.scoreGrade.textContent = grade.label;
  outputs.scoreBar.style.width = `${healthScore}%`;
  outputs.scoreDesc.textContent = grade.desc;

  const previous = state.previous;
  if (previous && Number.isFinite(previous.expectancy)) {
    const diff = metrics.expectancy - previous.expectancy;
    outputs.resultHistory.textContent =
      Math.abs(diff) < 0.05
        ? `지난번 결과(${previous.expectancy.toFixed(1)}세)와 같아요`
        : `지난번 결과(${previous.expectancy.toFixed(1)}세)보다 ${Math.abs(diff).toFixed(1)}년 ${diff > 0 ? "늘었어요" : "줄었어요"}`;
    outputs.resultHistory.hidden = false;
  } else {
    outputs.resultHistory.hidden = true;
  }

  outputs.formulaSummary.textContent = buildSummary(data, metrics);

  outputs.insights.innerHTML = "";
  [...metrics.insights]
    .sort((a, b) => a.delta - b.delta)
    .forEach(({ label, delta, text }) => {
      const item = document.createElement("li");
      const head = document.createElement("div");
      const name = document.createElement("strong");
      const badge = document.createElement("span");
      const body = document.createElement("p");

      head.className = "insight-head";
      name.textContent = label;
      badge.className = "insight-delta";
      badge.dataset.tone = delta > 0.05 ? "up" : delta < -0.05 ? "down" : "none";
      badge.textContent = Math.abs(delta) < 0.05 ? "영향 없음" : formatYears(delta);
      body.textContent = text;

      head.append(name, badge);
      item.append(head, body);
      outputs.insights.appendChild(item);
    });

  return { data, expectancy: metrics.expectancy, healthScore };
}

async function withTimeout(promise, ms = 1000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

async function loadSaved(key = STORAGE_KEY) {
  try {
    const raw = await withTimeout(Storage.getItem(key));
    return raw ? JSON.parse(raw) : null;
  } catch {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}

async function save(value, key = STORAGE_KEY) {
  const raw = JSON.stringify(value);
  try {
    await withTimeout(Storage.setItem(key, raw));
  } catch {
    try {
      window.localStorage.setItem(key, raw);
    } catch {
      // 저장하지 못해도 계산 결과는 그대로 보여줘요.
    }
  }
}

function readInputValues() {
  return Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, input.value]));
}

function applyInputValues(values) {
  Object.entries(values ?? {}).forEach(([key, value]) => {
    if (fields[key] && typeof value === "string") {
      fields[key].value = value;
    }
  });
}

// 계산을 두 번째로 끝낸, 앱을 충분히 써본 사용자에게만 한 번 리뷰를 요청해요.
async function maybeRequestReview() {
  if (state.reviewRequested || state.completions < 2) {
    return;
  }

  try {
    if (Review.request.isSupported()) {
      state.reviewRequested = true;
      await Review.request();
    }
  } catch {
    // 리뷰 요청이 실패해도 결과 화면에는 영향을 주지 않아요.
  }
}

function isReminderSupported() {
  try {
    return NOTIFICATION_TEMPLATE_CODE !== "" && Notification.requestAgreement.isSupported();
  } catch {
    return false;
  }
}

function renderReminder() {
  if (!isReminderSupported()) {
    reminderCard.hidden = true;
    return;
  }

  reminderCard.hidden = false;
  reminderButton.hidden = state.reminderAgreed;
  reminderStatus.hidden = !state.reminderAgreed;
  reminderStatus.textContent = "매주 알림을 받기로 했어요. 알림이 오면 이번 주 습관으로 다시 계산해 보세요.";
}

// 사용자가 알림 받기 버튼을 직접 눌렀을 때만 동의 화면을 띄워요.
function requestReminder() {
  reminderButton.disabled = true;
  let cleanup = () => {};

  const finish = () => {
    reminderButton.disabled = false;
    cleanup();
  };

  try {
    cleanup = Notification.requestAgreement({
      options: { templateCode: NOTIFICATION_TEMPLATE_CODE },
      onEvent: ({ type }) => {
        state.reminderAgreed = type !== "agreementRejected";
        if (state.reminderAgreed) {
          save({ agreed: true, agreedAt: Date.now() }, REMINDER_STORAGE_KEY);
        }
        try {
          Analytics.log({
            log_name: "reminder_agreement",
            log_type: "event",
            params: { result: type },
          }).catch(() => {});
        } catch {
          // 로그 전송 실패는 무시해요.
        }
        renderReminder();
        finish();
      },
      onError: () => {
        reminderStatus.textContent = "알림 설정을 열지 못했어요. 잠시 후 다시 시도해 주세요.";
        reminderStatus.hidden = false;
        finish();
      },
    });
  } catch {
    finish();
  }
}

function showResult({ restored = false } = {}) {
  const summary = renderResult();
  state.hasResult = true;
  result.hidden = false;
  outputs.resultDone.textContent = restored ? "지난번 입력으로 계산한 결과예요" : "계산이 완료됐어요";
  form.querySelector("#submit-button").textContent = "다시 계산하기";
  renderReminder();
  return summary;
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!validate()) {
    return;
  }

  const summary = showResult();
  resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
  resultCard.focus({ preventScroll: true });

  state.completions += 1;
  // 콘솔에서 전환 지표(계산 완료)로 등록해 쓸 수 있는 이벤트예요.
  try {
    Analytics.log({
      log_name: "life_expectancy_calculated",
      log_type: "event",
      params: {
        expectancy: summary.expectancy.toFixed(1),
        health_score: summary.healthScore,
        completion_count: state.completions,
      },
    }).catch(() => {});
  } catch {
    // 로그 전송 실패는 무시해요.
  }

  // 다음 계산부터는 방금 결과와 비교해서 보여줘요.
  state.previous = { expectancy: summary.expectancy };
  maybeRequestReview();

  await save({
    inputs: readInputValues(),
    expectancy: summary.expectancy,
    completions: state.completions,
    reviewRequested: state.reviewRequested,
    savedAt: Date.now(),
  });
}

function handleInput() {
  renderInputs();
  // 결과를 본 뒤에는 입력을 바꾸면 결과에도 바로 반영해요.
  if (state.hasResult && requiredFields.every(({ input }) => input.value !== "")) {
    renderResult();
  }
}

Object.values(fields).forEach((field) => {
  field.addEventListener("input", handleInput);
  field.addEventListener("change", handleInput);
});

form.addEventListener("submit", handleSubmit);

reminderButton.addEventListener("click", requestReminder);

editButton.addEventListener("click", () => {
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  fields.age.focus({ preventScroll: true });
});

async function init() {
  renderInputs();

  const reminder = await loadSaved(REMINDER_STORAGE_KEY);
  state.reminderAgreed = Boolean(reminder?.agreed);

  const saved = await loadSaved();
  if (!saved?.inputs) {
    return;
  }

  applyInputValues(saved.inputs);
  state.completions = Number(saved.completions) || 0;
  state.reviewRequested = Boolean(saved.reviewRequested);
  renderInputs();

  if (validate()) {
    state.previous = { expectancy: Number(saved.expectancy) };
    showResult({ restored: true });
    // 불러온 결과 자체와 비교하지 않도록, 다음 계산부터 비교 문구를 보여줘요.
    outputs.resultHistory.hidden = true;
  }
}

init();
