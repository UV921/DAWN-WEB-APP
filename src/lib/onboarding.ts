export type OnboardingAnswers = {
  why: string;
  whyCustom?: string;
  currentWake: string;
  wakeGoal: string;
  sleepGoal: string;
  friction: string;
  focusHabitKey: string;
  focusLabel: string;
  focusCustom?: string;
  identity: string;
  celebrate: "big" | "chill";
};

export type OnboardingAnalysis = {
  headline: string;
  sleepHours: number;
  stretchMin: number;
  verdict: string;
  risks: string[];
  strengths: string[];
  plan: string[];
};

export const ONBOARDING_STEPS = [
  {
    id: "why",
    prompt: "Why do mornings matter to you?",
    hint: "This line shows up when Dawn wakes you — make it real.",
    type: "choice" as const,
    options: [
      "Quiet focus before the world starts",
      "Prayer / spiritual start (Fajr)",
      "Training / gym consistency",
      "Stop losing the morning to my phone",
      "Feel in control of my day",
      "Other — I'll write it",
    ],
  },
  {
    id: "whyCustom",
    prompt: "Write your why in one sentence",
    hint: "Example: I want to own my mornings so I stop feeling behind all day.",
    type: "text" as const,
    when: (a: Partial<OnboardingAnswers>) =>
      Boolean(a.why?.toLowerCase().includes("other")),
  },
  {
    id: "currentWake",
    prompt: "What time do you usually wake now?",
    hint: "Be honest — we measure the gap, not perfection.",
    type: "time" as const,
    default: "08:00",
  },
  {
    id: "wakeGoal",
    prompt: "What wake time are you locking for 14 days?",
    hint: "Stretch you can hit ~80% of days. Fantasy goals break streaks.",
    type: "time" as const,
    default: "06:00",
  },
  {
    id: "sleepGoal",
    prompt: "What bedtime makes that wake realistic?",
    hint: "Aim for 7.5–8.5 hours. Early wake without early sleep burns out.",
    type: "time" as const,
    default: "22:30",
  },
  {
    id: "friction",
    prompt: "What usually kills your morning?",
    hint: "We'll build the first habit around this.",
    type: "choice" as const,
    options: [
      "Snooze / can't get out of bed",
      "Phone doomscroll first thing",
      "Went to bed too late",
      "No clear first action",
      "Tired / inconsistent sleep",
    ],
  },
  {
    id: "focusHabit",
    prompt: "One habit to master for 14 days?",
    hint: "One only. Stack later. Dawn scores this as your focus.",
    type: "choice" as const,
    options: [
      { key: "wakeEarly", label: "Wake early (hit my wake time)" },
      { key: "sleepEarly", label: "Sleep early (protect bedtime)" },
      { key: "noPhone", label: "No phone first 30–60 min" },
      { key: "fajr", label: "Fajr on time" },
      { key: "gym", label: "Morning gym / training" },
      { key: "quran", label: "Morning Quran" },
      { key: "custom", label: "Something else — I'll name it" },
    ],
  },
  {
    id: "focusCustom",
    prompt: "Name your first habit",
    hint: "Short and doable. e.g. Make bed, 10 pushups, cold water.",
    type: "text" as const,
    when: (a: Partial<OnboardingAnswers>) => a.focusHabitKey === "custom",
  },
  {
    id: "identity",
    prompt: "Finish this: “I am someone who…”",
    hint: "Identity sticks longer than motivation.",
    type: "text" as const,
    placeholder: "wakes early and owns the first hour",
  },
  {
    id: "celebrate",
    prompt: "How should Dawn celebrate early wakes?",
    hint: "Dopamine helps the habit stick.",
    type: "choice" as const,
    options: [
      "Big — XP, sound, streak fireworks",
      "Chill — quiet XP + streak only",
    ],
  },
  {
    id: "analysis",
    prompt: "Your Dawn plan",
    hint: "Review what we built from your answers — then start.",
    type: "analysis" as const,
  },
] as const;

export function mapCelebrate(raw: string): "big" | "chill" {
  return raw.toLowerCase().includes("chill") ? "chill" : "big";
}

function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function sleepHoursBetween(bed: string, wake: string) {
  let b = timeToMin(bed);
  let w = timeToMin(wake);
  if (w <= b) w += 24 * 60;
  return Math.round(((w - b) / 60) * 10) / 10;
}

export function buildOnboardingAnalysis(
  a: Partial<OnboardingAnswers>
): OnboardingAnalysis {
  const current = a.currentWake || "08:00";
  const wake = a.wakeGoal || "06:00";
  const sleep = a.sleepGoal || "22:30";
  const hours = sleepHoursBetween(sleep, wake);
  let stretch = timeToMin(current) - timeToMin(wake);
  if (stretch < -12 * 60) stretch += 24 * 60;
  if (stretch > 12 * 60) stretch -= 24 * 60;
  const stretchMin = Math.max(0, stretch);

  const risks: string[] = [];
  const strengths: string[] = [];
  const plan: string[] = [];

  if (hours < 7) {
    risks.push(
      `Only ~${hours}h sleep planned — bump bedtime earlier or wake a bit later.`
    );
  } else if (hours > 9) {
    risks.push(`~${hours}h is a long window — keep wake steady even if bed slips.`);
  } else {
    strengths.push(`~${hours}h sleep window looks sustainable.`);
  }

  if (stretchMin >= 90) {
    risks.push(
      `You're shifting ${Math.round(stretchMin / 60)}h+ earlier — move wake 20–30 min earlier every few days if it feels brutal.`
    );
  } else if (stretchMin >= 45) {
    strengths.push(
      `${stretchMin} min earlier than now — a solid stretch for 14 days.`
    );
  } else {
    strengths.push("Wake goal is close to your current time — high chance of sticking.");
  }

  const friction = a.friction || "";
  if (friction.toLowerCase().includes("phone")) {
    plan.push("First action after wake: phone stays face-down for 30 minutes.");
  } else if (friction.toLowerCase().includes("snooze")) {
    plan.push("Alarm across the room + one non-negotiable stand-up rule.");
  } else if (friction.toLowerCase().includes("late")) {
    plan.push(`Protect ${sleep} like a meeting — wind-down 30 min before.`);
  } else if (friction.toLowerCase().includes("action")) {
    plan.push(
      `Write tomorrow's first 10-minute action tonight: ${a.focusLabel || "your focus habit"}.`
    );
  } else if (friction.toLowerCase().includes("tired")) {
    plan.push("Same wake every day this week — even weekends within 45 min.");
  } else {
    plan.push("Same wake time daily. Log it in Dawn before anything else.");
  }

  plan.push(
    `Focus habit for 14 days: ${a.focusLabel || a.focusHabitKey || "wake early"}.`
  );
  plan.push(
    a.identity
      ? `Identity line: “I am someone who ${a.identity}.`
      : "Finish your identity line — it becomes your morning banner."
  );

  const why = a.whyCustom || a.why || "own your mornings";
  let verdict = "Ready to start — keep it boring and consistent.";
  if (hours < 7 && stretchMin >= 60) {
    verdict = "Ambitious setup — fix sleep hours first or the streak will crack.";
  } else if (risks.length === 0) {
    verdict = "Strong setup. Protect bedtime and the rest compounds.";
  }

  return {
    headline: why.length > 80 ? why.slice(0, 77) + "…" : why,
    sleepHours: hours,
    stretchMin,
    verdict,
    risks,
    strengths,
    plan,
  };
}
