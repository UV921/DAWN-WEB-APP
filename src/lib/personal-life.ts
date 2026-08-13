/** Deep personal interview → AI brief + locked habits. */

export type LifeQuestion = {
  id: string;
  section: string;
  prompt: string;
  hint?: string;
  options?: readonly string[];
  freeText: boolean;
  placeholder?: string;
};

export const LIFE_QUESTIONS: LifeQuestion[] = [
  {
    id: "lifeStage",
    section: "Your life",
    prompt: "Where are you in life right now?",
    hint: "This changes what a realistic morning looks like.",
    options: [
      "School / college",
      "First job / early career",
      "Established work",
      "Parenting",
      "Between chapters",
    ],
    freeText: true,
    placeholder: "Age range, city, anything that shapes your days…",
  },
  {
    id: "dayShape",
    section: "Your life",
    prompt: "What does a real weekday look like?",
    hint: "Work, school, shifts, caregiving — be specific.",
    options: [
      "Office / fixed hours",
      "Remote / flexible",
      "Student",
      "Shifts / irregular",
      "Between jobs",
    ],
    freeText: true,
    placeholder: "e.g. I start at 9, commute 40 min, gym after…",
  },
  {
    id: "mustStart",
    section: "Your life",
    prompt: "What’s the first immovable thing on a weekday?",
    hint: "The time you cannot miss — job, class, kids, commute.",
    options: [
      "Work / class by 8–9",
      "Work / class by 10+",
      "Kids / family first",
      "No hard start",
    ],
    freeText: true,
    placeholder: "Exact time you must be somewhere or online…",
  },
  {
    id: "home",
    section: "Your life",
    prompt: "Who shares your mornings and nights?",
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
    id: "chronotype",
    section: "Body",
    prompt: "Are you naturally a morning person?",
    options: [
      "Yes — easy early",
      "Neutral — I can shift",
      "Night owl — mornings hurt",
      "Depends on the week",
    ],
    freeText: true,
    placeholder: "When would you wake with no alarm?",
  },
  {
    id: "energy",
    section: "Body",
    prompt: "When do you actually feel sharp vs foggy?",
    options: [
      "Sharp early, crash afternoon",
      "Slow mornings, better late",
      "All-day flat",
      "Depends on sleep debt",
    ],
    freeText: true,
    placeholder: "Caffeine, naps, health stuff that matters…",
  },
  {
    id: "sleepQuality",
    section: "Body",
    prompt: "How do you actually sleep — not the time, the quality?",
    options: [
      "Mostly solid",
      "Light / wake often",
      "Hard to fall asleep",
      "Crash late, groggy",
    ],
    freeText: true,
    placeholder: "Snoring, stress, heat, noise, screens…",
  },
  {
    id: "wakeStruggle",
    section: "Mornings",
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
    id: "firstMinutes",
    section: "Mornings",
    prompt: "If the first 20 minutes went right, what would you be doing?",
    options: [
      "Out of bed + water / light",
      "Move my body",
      "Deep work before people",
      "Family / get others ready",
      "Phone-free quiet",
    ],
    freeText: true,
    placeholder: "Describe the morning you actually want…",
  },
  {
    id: "nightLife",
    section: "Nights",
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
    id: "screens",
    section: "Nights",
    prompt: "What happens with your phone after 9pm?",
    options: [
      "I put it away",
      "I try, then pick it up",
      "Bed scrolling every night",
      "Work Slack / email",
      "Games / YouTube / Reels",
    ],
    freeText: true,
    placeholder: "Where does the phone live at night?",
  },
  {
    id: "weekendDrift",
    section: "Nights",
    prompt: "How much do weekends wreck the clock?",
    options: [
      "Same times, mostly",
      "1–2 hours later",
      "Totally different schedule",
      "Social nights, dead mornings",
    ],
    freeText: true,
    placeholder: "Parties, family, gaming marathons…",
  },
  {
    id: "whyNow",
    section: "Stakes",
    prompt: "Why do you care about waking earlier — really?",
    hint: "Not a slogan. What would change?",
    options: [
      "Health / body",
      "Work / career edge",
      "Mental clarity",
      "Prove I can stick to something",
      "Family / being present",
    ],
    freeText: true,
    placeholder: "In one year, what should mornings have proven?",
  },
  {
    id: "failedBefore",
    section: "Stakes",
    prompt: "What morning plan already failed — and why?",
    hint: "Dawn will avoid repeating that.",
    options: [
      "Too many habits at once",
      "Alarm but no reason",
      "Bedtime never changed",
      "Life got busy",
      "I haven’t really tried",
    ],
    freeText: true,
    placeholder: "The honest post-mortem…",
  },
  {
    id: "nonNegotiable",
    section: "Stakes",
    prompt: "If you could only lock ONE win for 14 days, what is it?",
    options: [
      "Out of bed on time",
      "Phone stays away",
      "Sleep earlier",
      "Move my body",
      "Deep work block",
    ],
    freeText: true,
    placeholder: "Make it concrete — time + action.",
  },
  {
    id: "friction",
    section: "Coach",
    prompt: "What’s one friction nobody would guess from a habit app?",
    freeText: true,
    placeholder:
      "e.g. I share a room, winter dark kills me, I game until 2, exams in March…",
  },
  {
    id: "accountability",
    section: "Coach",
    prompt: "How hard should Dawn push you?",
    options: [
      "Strict — lock habits, don’t ask",
      "Firm but fair",
      "Gentle reminders only",
      "Let me choose everything",
    ],
    freeText: true,
    placeholder: "What actually makes you follow through?",
  },
  {
    id: "avoid",
    section: "Coach",
    prompt: "What should Dawn never push on you?",
    options: [
      "Gym guilt",
      "Religious habits",
      "Long routines",
      "Public / Discord flex",
      "Nothing — push me",
    ],
    freeText: true,
    placeholder: "Boundaries keep the coach useful.",
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
  const night = answers.nightLife || answers.screens || "late nights";
  const focus = answers.nonNegotiable || answers.firstMinutes || "getting out of bed on time";
  const avoid = answers.avoid || "generic advice";

  const anchors: string[] = [];
  if (answers.lifeStage) anchors.push(`Life: ${clip(answers.lifeStage, 80)}`);
  if (answers.dayShape) anchors.push(`Days: ${clip(answers.dayShape, 90)}`);
  if (answers.mustStart) anchors.push(`Must start: ${clip(answers.mustStart, 70)}`);
  if (answers.home) anchors.push(`Home: ${clip(answers.home, 70)}`);
  if (answers.chronotype) anchors.push(`Clock: ${clip(answers.chronotype, 70)}`);
  if (answers.energy) anchors.push(`Energy: ${clip(answers.energy, 70)}`);
  if (answers.sleepQuality)
    anchors.push(`Sleep: ${clip(answers.sleepQuality, 70)}`);
  if (answers.friction) anchors.push(`Hidden: ${clip(answers.friction, 90)}`);
  if (answers.failedBefore)
    anchors.push(`Failed before: ${clip(answers.failedBefore, 80)}`);
  if (answers.accountability)
    anchors.push(`Push: ${clip(answers.accountability, 70)}`);

  return {
    headline: `Mornings built around ${clip(why, 48)}`,
    todayAngle: `Protect the first minutes: ${clip(struggle, 100)}. One win: ${clip(focus, 80)}.`,
    nightAngle: `Tonight’s real enemy is ${clip(night, 90)}. Wind down around that — not around “discipline”.`,
    focus: clip(focus, 120),
    avoid: clip(avoid, 100),
    anchors: anchors.slice(0, 6),
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

export function wantsStrictLock(answers: Record<string, string>): boolean {
  const a = (answers.accountability || "").toLowerCase();
  if (a.includes("let me choose")) return false;
  return true;
}
