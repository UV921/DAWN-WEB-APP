import { z } from "zod";
import type { HabitLogLike } from "@/lib/habits";
import {
  buildCoachPlan,
  buildDaySleepReport,
  buildWeekSleepReport,
  idealBedtimeForWake,
} from "@/lib/sleep-report";

export const AiCoachSchema = z.object({
  headline: z.string(),
  why: z.string(),
  tonightBed: z.string(),
  windDown: z.string(),
  morningWake: z.string(),
  steps: z.array(z.string()).min(2).max(6),
  pepTalk: z.string(),
  frictionFix: z.string(),
});

export type AiCoachResult = z.infer<typeof AiCoachSchema>;

export type AiBackend = "gemini" | "openai";

export function resolveAiBackend(): AiBackend | null {
  const forced = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (forced === "gemini" && process.env.GEMINI_API_KEY?.trim()) return "gemini";
  if (forced === "openai" && process.env.OPENAI_API_KEY?.trim()) return "openai";
  // Prefer Gemini when both exist (user asked Gemini-oriented)
  if (process.env.GEMINI_API_KEY?.trim()) return "gemini";
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  return null;
}

export function isAiConfigured(): boolean {
  return resolveAiBackend() !== null;
}

export function aiProviderLabel(): string {
  const backend = resolveAiBackend();
  if (backend === "gemini") return "Gemini";
  if (!backend) return "None";
  const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  if (base.includes("groq")) return "Groq";
  if (base.includes("openrouter")) return "OpenRouter";
  if (base.includes("localhost") || base.includes("11434")) return "Ollama";
  return "OpenAI";
}

function compactLogs(logs: HabitLogLike[]) {
  return logs.slice(-14).map((l) => ({
    date: l.date,
    bedtime: l.bedtime,
    wakeTime: l.wakeTime,
    checks: l.checks ?? {
      sleepEarly: l.sleepEarly,
      wakeEarly: l.wakeEarly,
      noPhone: l.noPhone,
      gym: l.gym,
      reading: l.reading,
      quran: l.quran,
    },
  }));
}

function buildPrompt(opts: {
  logs: HabitLogLike[];
  today: string;
  sleepGoal: string;
  wakeGoal: string;
  name?: string | null;
  whyLine?: string | null;
  lifeAnswers?: Record<string, string>;
  lifeBrief?: { headline?: string; todayAngle?: string; nightAngle?: string; focus?: string; avoid?: string } | null;
}) {
  const todayLog = opts.logs.find((l) => l.date === opts.today);
  const day = buildDaySleepReport(
    todayLog,
    opts.today,
    opts.sleepGoal,
    opts.wakeGoal,
    opts.logs
  );
  const week = buildWeekSleepReport(
    opts.logs.slice(-7),
    opts.sleepGoal,
    opts.wakeGoal
  );
  const local = buildCoachPlan(opts.logs, opts.sleepGoal, opts.wakeGoal);
  const idealBed = idealBedtimeForWake(opts.wakeGoal, 8);

  const system = `You are Dawn, a high-level morning architect.
You already know this person's life (work, home, nights, why they care). Use that. Do not give generic advice.
Goal: SLEEP EARLIER and WAKE EARLIER with almost zero friction.
Be specific, realistic, kind but firm. Prescribe actions, don't ask permission.
No medical diagnosis. No guilt spiral. No religion unless they brought it up.
Use short sentences. Prefer concrete times (HH:MM).
Return ONLY valid JSON matching the schema — no markdown.`;

  const userPayload = {
    name: opts.name || "friend",
    why: opts.whyLine || "",
    life: opts.lifeAnswers || {},
    brief: opts.lifeBrief || null,
    today: opts.today,
    goals: {
      sleepGoal: opts.sleepGoal,
      wakeGoal: opts.wakeGoal,
      idealBedFor8h: idealBed,
    },
    todayScore: day,
    weekStats: week,
    localHeuristicPlan: local,
    recentLogs: compactLogs(opts.logs),
    schema: {
      headline: "string — one punchy mission for tonight/tomorrow",
      why: "string — why this matters for early rising, based on THEIR data",
      tonightBed: "HH:MM",
      windDown: "HH:MM",
      morningWake: "HH:MM — usually their wakeGoal",
      steps: ["2-5 concrete actions in order"],
      pepTalk: "1-2 sentences motivation",
      frictionFix:
        "one habit design tweak that makes tomorrow easier (environment/cue)",
    },
  };

  return {
    system,
    user: `Build tonight's early-rise plan from this data:\n${JSON.stringify(userPayload)}`,
  };
}

function parseCoachJson(
  content: string
): { ok: true; coach: AiCoachResult } | { ok: false; error: string } {
  // Strip accidental markdown fences
  const cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, error: "AI returned non-JSON" };
  }

  const coach = AiCoachSchema.safeParse(parsed);
  if (!coach.success) {
    return { ok: false, error: "AI JSON shape mismatch" };
  }
  return { ok: true, coach: coach.data };
}

async function callGemini(
  system: string,
  user: string
): Promise<{ ok: true; coach: AiCoachResult; provider: string } | { ok: false; error: string }> {
  const apiKey = process.env.GEMINI_API_KEY!.trim();
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.6,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `Gemini error ${res.status}: ${text.slice(0, 280)}` };
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const content = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("")
    .trim();
  if (!content) return { ok: false, error: "Empty Gemini response" };

  const parsed = parseCoachJson(content);
  if (!parsed.ok) return parsed;
  return { ok: true, coach: parsed.coach, provider: `Gemini · ${model}` };
}

async function callOpenAiCompatible(
  system: string,
  user: string
): Promise<{ ok: true; coach: AiCoachResult; provider: string } | { ok: false; error: string }> {
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
      ...(base.includes("openrouter")
        ? {
            "HTTP-Referer":
              process.env.NEXTAUTH_URL || "http://localhost:3066",
          }
        : {}),
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `AI error ${res.status}: ${text.slice(0, 280)}` };
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return { ok: false, error: "Empty AI response" };

  const parsed = parseCoachJson(content);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    coach: parsed.coach,
    provider: `${aiProviderLabel()} · ${model}`,
  };
}

export async function generateAiCoach(opts: {
  logs: HabitLogLike[];
  today: string;
  sleepGoal: string;
  wakeGoal: string;
  name?: string | null;
  whyLine?: string | null;
  lifeAnswers?: Record<string, string>;
  lifeBrief?: { headline?: string; todayAngle?: string; nightAngle?: string; focus?: string; avoid?: string } | null;
}): Promise<
  | { ok: true; coach: AiCoachResult; provider: string }
  | { ok: false; error: string }
> {
  const backend = resolveAiBackend();
  if (!backend) {
    return {
      ok: false,
      error: "Set GEMINI_API_KEY or OPENAI_API_KEY in .env",
    };
  }

  const { system, user } = buildPrompt(opts);

  try {
    if (backend === "gemini") return await callGemini(system, user);
    return await callOpenAiCompatible(system, user);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "AI request failed",
    };
  }
}

/** One actionable tonight plan from real habit history — not generic fluff. */
export const TonightPlanSchema = z.object({
  tip: z.string().min(8).max(220),
  goalText: z.string().min(4).max(120),
  todos: z.array(z.string().min(1).max(80)).min(0).max(4),
  bedBy: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export type TonightPlan = z.infer<typeof TonightPlanSchema>;

async function rawAiJson(
  system: string,
  user: string
): Promise<{ ok: true; text: string; provider: string } | { ok: false; error: string }> {
  const backend = resolveAiBackend();
  if (!backend) {
    return { ok: false, error: "Set GEMINI_API_KEY or OPENAI_API_KEY in .env" };
  }

  if (backend === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY!.trim();
    const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` +
      `?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.5,
          responseMimeType: "application/json",
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `Gemini error ${res.status}: ${text.slice(0, 280)}`,
      };
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const content = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("")
      .trim();
    if (!content) return { ok: false, error: "Empty Gemini response" };
    return { ok: true, text: content, provider: `Gemini · ${model}` };
  }

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
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `AI error ${res.status}: ${text.slice(0, 280)}` };
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return { ok: false, error: "Empty AI response" };
  return {
    ok: true,
    text: content,
    provider: `${aiProviderLabel()} · ${model}`,
  };
}

export async function generateTonightPlan(opts: {
  logs: HabitLogLike[];
  today: string;
  sleepGoal: string;
  wakeGoal: string;
  name?: string | null;
  whyLine?: string | null;
  lifeAnswers?: Record<string, string>;
  lifeBrief?: { headline?: string; todayAngle?: string; nightAngle?: string; focus?: string; avoid?: string } | null;
}): Promise<
  | { ok: true; plan: TonightPlan; provider: string }
  | { ok: false; error: string }
> {
  const week = compactLogs(opts.logs).slice(-7);
  const earlyWakes = week.filter((l) => l.checks?.wakeEarly).length;
  const lateBeds = week.filter((l) => {
    if (!l.bedtime) return false;
    return l.bedtime > opts.sleepGoal;
  }).length;

  const system = `You are Dawn. Use the user's life interview AND their habit log to prescribe tomorrow.
Return JSON: { "tip": "one sentence rooted in their pattern + life", "goalText": "one morning line", "todos": ["up to 4 tiny tasks"], "bedBy": "HH:MM optional" }.
No fluff. No "Built for you". Be concrete with times. Respect their avoid list.`;

  const user = JSON.stringify({
    name: opts.name || "friend",
    why: opts.whyLine || "",
    life: opts.lifeAnswers || {},
    brief: opts.lifeBrief || null,
    goals: { sleepGoal: opts.sleepGoal, wakeGoal: opts.wakeGoal },
    last7Days: week,
    stats: {
      earlyWakesOutOf: `${earlyWakes}/${week.length}`,
      nightsPastSleepGoal: lateBeds,
    },
  });

  try {
    const raw = await rawAiJson(system, user);
    if (!raw.ok) return raw;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.text);
    } catch {
      return { ok: false, error: "AI returned non-JSON" };
    }
    const plan = TonightPlanSchema.safeParse(parsed);
    if (!plan.success) return { ok: false, error: "AI JSON shape mismatch" };
    return { ok: true, plan: plan.data, provider: raw.provider };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "AI request failed",
    };
  }
}
