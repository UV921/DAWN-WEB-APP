import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDefaultHabits } from "@/lib/ensure-habits";
import { formatLocalDate, mergeLogChecks } from "@/lib/habits";
import {
  buildCoachPlan,
  buildDaySleepReport,
  buildWeekSleepReport,
} from "@/lib/sleep-report";
import { isAiConfigured, resolveAiBackend, aiProviderLabel } from "@/lib/ai-coach";
import {
  LIFE_QUESTIONS,
  buildLocalLifeBrief,
  parseLifeJson,
  type LifeBrief,
} from "@/lib/personal-life";

const SuggestSchema = z.object({
  analysis: z.string(),
  focus: z.string(),
  suggestedHabits: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        description: z.string(),
        reason: z.string(),
      })
    )
    .min(1)
    .max(6),
  tonightTip: z.string(),
  personalBrief: z
    .object({
      headline: z.string(),
      todayAngle: z.string(),
      nightAngle: z.string(),
      focus: z.string(),
      avoid: z.string(),
      anchors: z.array(z.string()).max(6),
    })
    .optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  let saved: ReturnType<typeof parseLifeJson> | null = null;
  if (session?.user?.id) {
    const u = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { lifeJson: true },
    });
    saved = parseLifeJson(u?.lifeJson);
  }

  return NextResponse.json({
    questions: LIFE_QUESTIONS,
    aiConfigured: isAiConfigured(),
    provider: isAiConfigured() ? aiProviderLabel() : null,
    savedAnswers: saved?.answers || {},
    savedBrief: saved?.brief || null,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const answers = (body.answers || {}) as Record<string, string>;

  const habits = await ensureDefaultHabits(session.user.id);
  const existingKeys = new Set(habits.map((h) => h.key));

  const since = formatLocalDate(
    new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  );
  const rawLogs = await prisma.habitLog.findMany({
    where: { userId: session.user.id, date: { gte: since } },
    orderBy: { date: "asc" },
  });
  const logs = rawLogs.map((l) => ({
    ...l,
    checks: mergeLogChecks(l),
  }));

  const today = formatLocalDate(new Date());
  const day = buildDaySleepReport(
    logs.find((l) => l.date === today),
    today,
    session.user.sleepGoal,
    session.user.wakeGoal,
    logs
  );
  const week = buildWeekSleepReport(
    logs,
    session.user.sleepGoal,
    session.user.wakeGoal
  );
  const local = buildCoachPlan(
    logs,
    session.user.sleepGoal,
    session.user.wakeGoal
  );

  const ruleSuggestions = buildRuleSuggestions(answers, existingKeys);

  let aiResult: z.infer<typeof SuggestSchema> | null = null;
  let provider: string | null = null;

  if (isAiConfigured() && resolveAiBackend()) {
    const ai = await runInterviewAi({
      answers,
      existingHabits: habits.map((h) => ({ key: h.key, label: h.label })),
      day,
      week,
      local,
      name: session.user.name,
      sleepGoal: session.user.sleepGoal,
      wakeGoal: session.user.wakeGoal,
    });
    if (ai.ok) {
      aiResult = ai.data;
      provider = ai.provider;
    }
  }

  const localBrief = buildLocalLifeBrief(answers);
  const brief: LifeBrief = aiResult?.personalBrief
    ? {
        ...aiResult.personalBrief,
        updatedAt: new Date().toISOString(),
      }
    : localBrief;

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      lifeJson: JSON.stringify({ answers, brief }),
      whyLine: brief.focus.slice(0, 160),
      ...(answers.whyNow
        ? {
            identityLine: answers.whyNow
              .replace(/^I (am|want to be) /i, "")
              .slice(0, 120),
          }
        : {}),
    },
  });

  const suggested = (aiResult?.suggestedHabits || ruleSuggestions).filter(
    (s) => !existingKeys.has(s.key)
  );

  return NextResponse.json({
    analysis:
      aiResult?.analysis || buildRuleAnalysis(answers, day, week),
    focus: aiResult?.focus || brief.focus,
    tonightTip: aiResult?.tonightTip || brief.nightAngle,
    personalBrief: brief,
    suggestedHabits: suggested,
    existingHabits: habits,
    dataSnapshot: {
      wakeOnTimeRate: week.wakeOnTimeRate,
      bedOnTimeRate: week.onTimeRate,
      avgSleep: week.avgDurationHours,
      sleepDebt: week.sleepDebtHours,
      nightScore: day.score,
    },
    provider,
    usedAi: Boolean(aiResult),
  });
}

function buildRuleSuggestions(
  answers: Record<string, string>,
  existing: Set<string>
) {
  const out: {
    key: string;
    label: string;
    description: string;
    reason: string;
  }[] = [];

  const add = (
    key: string,
    label: string,
    description: string,
    reason: string
  ) => {
    if (existing.has(key) || out.some((o) => o.key === key)) return;
    out.push({ key, label, description, reason });
  };

  const blob = Object.values(answers).join(" ").toLowerCase();

  add(
    "sleepEarly",
    "Sleep early",
    "In bed by your sleep goal",
    "Foundation for waking early"
  );
  add(
    "wakeEarly",
    "Wake early",
    "Up by your wake goal",
    "Locks your body clock"
  );

  if (
    blob.includes("phone") ||
    blob.includes("scroll") ||
    blob.includes("snooze")
  ) {
    add(
      "noPhone",
      "No phone",
      "Phone away first 30–60 min",
      "You mentioned phone / snooze stealing the first minutes"
    );
  }
  if (blob.includes("quran") || blob.includes("prayer") || blob.includes("faith") || blob.includes("fajr")) {
    add("quran", "Quran", "Morning Quran reading", "You tied mornings to faith");
    add("fajr", "Fajr", "Pray Fajr on time", "You mentioned prayer / faith");
  }
  if (blob.includes("read")) {
    add("reading", "Reading", "Morning reading session", "You want mind fuel");
  }
  if (blob.includes("journal") || blob.includes("overthink") || blob.includes("anxiety")) {
    add(
      "journal",
      "Journal",
      "5–10 min morning dump",
      "Helps clear night noise you described"
    );
  }
  if (blob.includes("gym") || blob.includes("body") || blob.includes("health") || blob.includes("move")) {
    add("gym", "Gym / move", "Morning training or walk", "You care about body / health");
  }
  if (blob.includes("walk") || blob.includes("sun")) {
    add("walk", "Morning walk", "10–20 min walk / sunlight", "Light + movement");
  }
  if (blob.includes("work") || blob.includes("career") || blob.includes("deep work")) {
    add(
      "deepWork",
      "Deep work block",
      "25–50 min focused work after wake",
      "You want mornings for career edge"
    );
  }
  if (blob.includes("routine") || blob.includes("stick")) {
    add(
      "makeBed",
      "Make bed",
      "Make bed right after waking",
      "Tiny win that starts momentum"
    );
  }

  // Focus from nonNegotiable
  const focus = (answers.nonNegotiable || "").toLowerCase();
  if (focus.includes("phone")) {
    add("noPhone", "No phone", "Phone away first hour", "Your one win");
  }
  if (focus.includes("sleep")) {
    add("sleepEarly", "Sleep early", "Protect bedtime", "Your one win");
  }

  return out.slice(0, 6);
}

function buildRuleAnalysis(
  answers: Record<string, string>,
  day: ReturnType<typeof buildDaySleepReport>,
  week: ReturnType<typeof buildWeekSleepReport>
) {
  const bits = [
    answers.dayShape
      ? `Your days: ${answers.dayShape.slice(0, 140)}.`
      : null,
    answers.wakeStruggle
      ? `Alarm reality: ${answers.wakeStruggle.slice(0, 120)}.`
      : null,
    answers.friction
      ? `Hidden friction: ${answers.friction.slice(0, 120)}.`
      : null,
    `Logs (7d): wake on-time ${week.wakeOnTimeRate}%, bed on-time ${week.onTimeRate}%, avg sleep ${week.avgDurationHours ?? "—"}h.`,
    day.score > 0
      ? `Tonight’s score ${day.score}/100.`
      : "Log bedtime + wake so advice gets sharper.",
  ].filter(Boolean);
  return bits.join(" ");
}

async function runInterviewAi(opts: {
  answers: Record<string, string>;
  existingHabits: { key: string; label: string }[];
  day: ReturnType<typeof buildDaySleepReport>;
  week: ReturnType<typeof buildWeekSleepReport>;
  local: ReturnType<typeof buildCoachPlan>;
  name?: string | null;
  sleepGoal: string;
  wakeGoal: string;
}): Promise<
  | { ok: true; data: z.infer<typeof SuggestSchema>; provider: string }
  | { ok: false }
> {
  const backend = resolveAiBackend();
  if (!backend) return { ok: false };

  const system = `You are Dawn — a personal morning coach, not a generic habit app.
The user answered deep questions about their real life (work, home, night friction, why they care).
Write analysis that quotes / reflects THEIR specifics — never generic "consistency is key" filler.
Respect "avoid" boundaries.
Suggest 2-5 NEW habits they don't already have, with reasons tied to their answers.
Also produce personalBrief: dynamic copy for their dashboard (headline, todayAngle, nightAngle, focus, avoid, anchors[] of short personal facts).
Return ONLY JSON.`;

  const user = JSON.stringify({
    name: opts.name,
    personalAnswers: opts.answers,
    existingHabits: opts.existingHabits,
    sleepGoal: opts.sleepGoal,
    wakeGoal: opts.wakeGoal,
    todayReport: opts.day,
    weekStats: opts.week,
    localPlan: opts.local,
    schema: {
      analysis: "string — specific to their life answers + data",
      focus: "string — one 14-day focus from their nonNegotiable",
      suggestedHabits: [
        {
          key: "camelCaseKey",
          label: "Label",
          description: "short",
          reason: "why for THEM specifically",
        },
      ],
      tonightTip: "one concrete tip aimed at their nightLife friction",
      personalBrief: {
        headline: "personal, not generic",
        todayAngle: "what today should protect, from their wakeStruggle",
        nightAngle: "what tonight should protect, from their nightLife",
        focus: "one win",
        avoid: "what not to push",
        anchors: ["short personal fact", "..."],
      },
    },
  });

  try {
    let content = "";
    let provider = "";

    if (backend === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY!.trim();
      const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.55,
            responseMimeType: "application/json",
          },
        }),
      });
      if (!res.ok) return { ok: false };
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      content =
        data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ||
        "";
      provider = `Gemini · ${model}`;
    } else {
      const apiKey = process.env.OPENAI_API_KEY!.trim();
      const base = (
        process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
      ).replace(/\/$/, "");
      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.55,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) return { ok: false };
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      content = data.choices?.[0]?.message?.content || "";
      provider = `${aiProviderLabel()} · ${model}`;
    }

    const cleaned = content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = SuggestSchema.safeParse(JSON.parse(cleaned));
    if (!parsed.success) return { ok: false };
    return { ok: true, data: parsed.data, provider };
  } catch {
    return { ok: false };
  }
}
