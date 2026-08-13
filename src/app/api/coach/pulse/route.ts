import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { isAiConfigured, resolveAiBackend, aiProviderLabel } from "@/lib/ai-coach";
import {
  buildMorningPulse,
  type MorningPulse,
  type PulseTone,
  type WeekPulse,
} from "@/lib/morning-pulse";

const Body = z.object({
  week: z.object({
    days: z.number(),
    wakeOnTime: z.number(),
    wakeLogged: z.number(),
    nightsClosed: z.number(),
    habitHits: z.number(),
    habitSlots: z.number(),
  }),
  todayWake: z.boolean(),
  habitsDone: z.number(),
  habitsTotal: z.number(),
  tasksDone: z.number(),
  tasksTotal: z.number(),
  nightClosed: z.boolean(),
  streak: z.number(),
  runDay: z.number().optional(),
  runTotal: z.number().optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad pulse payload" }, { status: 400 });
  }

  const local = buildMorningPulse(parsed.data);
  const backend = resolveAiBackend();
  if (!isAiConfigured() || !backend) {
    return NextResponse.json({ pulse: local, usedAi: false });
  }

  const ai = await refinePulse(local, parsed.data.week);
  return NextResponse.json({
    pulse: ai || local,
    usedAi: Boolean(ai),
    provider: ai ? aiProviderLabel() : null,
  });
}

async function refinePulse(
  local: MorningPulse,
  week: WeekPulse
): Promise<MorningPulse | null> {
  const backend = resolveAiBackend();
  if (!backend) return null;

  const system = `You are Dawn. Honest morning coach. Use the user's REAL week numbers.
If they're slipping, say so plainly. No "you've got this" fluff. No medical talk.
Return JSON: { "tone": "start"|"good"|"slip"|"danger", "headline": "max 90 chars", "body": "max 180 chars", "nextMove": "max 90 chars, one action" }.`;

  const user = JSON.stringify({ localDraft: local, week });

  try {
    let text = "";
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
            temperature: 0.45,
            responseMimeType: "application/json",
          },
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      text =
        data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ||
        "";
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
          temperature: 0.45,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      text = data.choices?.[0]?.message?.content || "";
    }
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const j = JSON.parse(cleaned) as MorningPulse;
    const tones: PulseTone[] = ["start", "good", "slip", "danger"];
    if (!j.headline || !j.body || !j.nextMove) return null;
    return {
      tone: tones.includes(j.tone) ? j.tone : local.tone,
      headline: String(j.headline).slice(0, 110),
      body: String(j.body).slice(0, 240),
      nextMove: String(j.nextMove).slice(0, 120),
    };
  } catch {
    return null;
  }
}
