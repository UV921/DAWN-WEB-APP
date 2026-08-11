/** Deep personal interview → dynamic brief (not static templates). */

export type LifeQuestion = {
  id: string;
  prompt: string;
  hint?: string;
  /** Multiple choice chips; free text always allowed after */
  options?: readonly string[];
  freeText: boolean;
  placeholder?: string;
};

export const LIFE_QUESTIONS: LifeQuestion[] = [
  {
    id: "dayShape",
    prompt: "What does a real weekday look like for you right now?",
    hint: "Work, school, shifts, caregiving — be specific.",
    options: [
      "Office / fixed hours",
      "Remote / flexible",
      "Student",
      "Shifts / irregular",
      "Between jobs",
    ],
    freeText: true,
    placeholder: "e.g. I start work at 9, commute 40 min, gym after…",
  },
  {
    id: "wakeStruggle",
    prompt: "When the alarm goes off, what usually wins?",
    hint: "The honest version — not the ideal you.",
    options: [
      "Snooze loop",
      "Phone scroll in bed",
      "I get up but feel wrecked",
      "I wake fine, then lose the morning",
      "I already wake early most days",
    ],
    freeText: true,
    placeholder: "What happens in those first 10 minutes?",
  },
  {
    id: "nightLife",
    prompt: "What keeps you up later than you want?",
    options: [
      "Work / deadlines",
      "Friends / family",
      "Shows / games",
      "Anxiety / overthinking",
      "Phone rabbit holes",
      "Nothing specific — bad habit",
    ],
    freeText: true,
    placeholder: "Who or what is in the room with you at night?",
  },
  {
    id: "energy",
    prompt: "When do you actually feel sharp vs foggy?",
    options: [
      "Sharp early, crash afternoon",
      "Slow mornings, better late",
      "All-day flat",
      "Depends on sleep debt",
    ],
    freeText: true,
    placeholder: "Any caffeine, naps, or health stuff that matters?",
  },
  {
    id: "home",
    prompt: "Who shares your mornings / nights?",
    options: [
      "Live alone",
      "Partner",
      "Family / parents",
      "Roommates",
      "Kids",
    ],
    freeText: true,
    placeholder: "Does anyone else wake early, make noise, or need you?",
  },
  {
    id: "whyNow",
    prompt: "Why do you care about waking earlier — really?",
    hint: "Not a slogan. What would change in your life?",
    options: [
      "Faith / prayer",
      "Health / body",
      "Work / career edge",
      "Mental clarity",
      "Prove I can stick to something",
    ],
    freeText: true,
    placeholder: "In one year, what do you want mornings to prove?",
  },
  {
    id: "friction",
    prompt: "What’s one personal friction nobody would guess from a habit app?",
    freeText: true,
    placeholder:
      "e.g. I share a room, winter dark kills me, I game until 2, exams in March…",
  },
  {
    id: "nonNegotiable",
    prompt: "If you could only lock ONE morning win for 14 days, what is it?",
    options: [
      "Out of bed on time",
      "Phone stays away",
      "Sleep earlier",
      "Move my body",
      "Prayer / Quran",
      "Deep work block",
    ],
    freeText: true,
    placeholder: "Make it concrete — time + action.",
  },
  {
    id: "avoid",
    prompt: "What should Dawn never push on you?",
    options: [
      "Gym guilt",
      "Religious habits",
      "Long routines",
      "Public / Discord flex",
      "Nothing — push me",
    ],
    freeText: true,
    placeholder: "Boundaries help the coach stay useful.",
  },
];

export type LifeBrief = {
  headline: string;
  todayAngle: string;
  nightAngle: string;
  focus: string;
  avoid: string;
  anchors: string[];
  updatedAt: string;
};

export function parseLifeJson(raw: string | null | undefined): {
  answers: Record<string, string>;
  brief: LifeBrief | null;
} {
  try {
    const j = JSON.parse(raw || "{}") as {
      answers?: Record<string, string>;
      brief?: LifeBrief;
    };
    return {
      answers: j.answers && typeof j.answers === "object" ? j.answers : {},
      brief: j.brief && typeof j.brief === "object" ? j.brief : null,
    };
  } catch {
    return { answers: {}, brief: null };
  }
}

/** Local brief when AI is offline — still personal from their words. */
export function buildLocalLifeBrief(
  answers: Record<string, string>
): LifeBrief {
  const why = answers.whyNow || "showing up earlier";
  const struggle = answers.wakeStruggle || "the first minutes after the alarm";
  const night = answers.nightLife || "late nights";
  const focus = answers.nonNegotiable || "getting out of bed on time";
  const avoid = answers.avoid || "generic advice";
  const friction = answers.friction;
  const day = answers.dayShape;
  const home = answers.home;

  const anchors: string[] = [];
  if (day) anchors.push(`Your days: ${clip(day, 90)}`);
  if (home) anchors.push(`Home: ${clip(home, 70)}`);
  if (friction) anchors.push(`Hidden friction: ${clip(friction, 90)}`);
  if (answers.energy) anchors.push(`Energy: ${clip(answers.energy, 70)}`);

  return {
    headline: `Built around your life — not a template`,
    todayAngle: `Protect the first minutes: ${clip(struggle, 100)}. Your one win: ${clip(focus, 80)}.`,
    nightAngle: `Tonight’s real enemy isn’t “discipline” — it’s ${clip(night, 90)}. Wind down earlier around that.`,
    focus: clip(focus, 120),
    avoid: clip(avoid, 100),
    anchors,
    updatedAt: new Date().toISOString(),
  };
}

function clip(s: string, n: number) {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

export function lifeAnswersFilled(answers: Record<string, string>): boolean {
  const keys = ["dayShape", "wakeStruggle", "whyNow", "nonNegotiable"];
  return keys.every((k) => Boolean(answers[k]?.trim()));
}
