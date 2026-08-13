import { prisma } from "@/lib/prisma";
import { slugifyHabitKey } from "@/lib/habits";

export type PrescribedHabit = {
  key: string;
  label: string;
  description: string;
  reason: string;
};

function blobOf(answers: Record<string, string>) {
  return Object.values(answers).join(" ").toLowerCase();
}

function blockedByAvoid(key: string, avoid: string) {
  const a = avoid.toLowerCase();
  if (!a.trim() || a.includes("nothing") || a.includes("push me")) return false;
  if (a.includes("gym") && (key === "gym" || key === "walk")) return true;
  if (
    (a.includes("religious") || a.includes("faith") || a.includes("prayer")) &&
    (key === "quran" || key === "fajr")
  ) {
    return true;
  }
  if (a.includes("long") && (key === "deepWork" || key === "reading")) {
    return true;
  }
  if (a.includes("public") && key === "discordFlex") return true;
  return false;
}

/** Rule-based prescription when AI is offline — still tied to their answers. */
export function prescribeFromAnswers(
  answers: Record<string, string>,
  existing: Set<string>
): PrescribedHabit[] {
  const out: PrescribedHabit[] = [];
  const add = (h: PrescribedHabit) => {
    if (existing.has(h.key) || out.some((o) => o.key === h.key)) return;
    if (blockedByAvoid(h.key, answers.avoid || "")) return;
    out.push(h);
  };

  const blob = blobOf(answers);
  const focus = (answers.nonNegotiable || answers.firstMinutes || "").toLowerCase();

  add({
    key: "wakeEarly",
    label: "Wake early",
    description: "Up by your wake goal",
    reason: "This is the clock everything else hangs on",
  });
  add({
    key: "sleepEarly",
    label: "Sleep early",
    description: "In bed by your sleep goal",
    reason: answers.failedBefore?.toLowerCase().includes("bed")
      ? "You already said bedtime was why plans failed"
      : "Wake time is fake if bedtime slips",
  });

  if (
    blob.includes("phone") ||
    blob.includes("scroll") ||
    blob.includes("reels") ||
    blob.includes("snooze") ||
    focus.includes("phone")
  ) {
    add({
      key: "noPhone",
      label: "No phone",
      description: "Phone away first 30–60 min",
      reason: "Your answers say the phone steals the first minutes",
    });
  }

  if (
    blob.includes("gym") ||
    blob.includes("body") ||
    blob.includes("health") ||
    blob.includes("move") ||
    focus.includes("move") ||
    focus.includes("body")
  ) {
    add({
      key: "gym",
      label: "Move body",
      description: "Walk, gym, or stretch after wake",
      reason: "You tied mornings to health / movement",
    });
  }

  if (blob.includes("walk") || blob.includes("sun") || blob.includes("light")) {
    add({
      key: "walk",
      label: "Morning light",
      description: "10–20 min outside / sunlight",
      reason: "Light is the fastest way to shift a night-owl clock",
    });
  }

  if (
    blob.includes("work") ||
    blob.includes("career") ||
    blob.includes("deep") ||
    focus.includes("deep work")
  ) {
    add({
      key: "deepWork",
      label: "Deep work block",
      description: "25–50 min focused work after wake",
      reason: "You want mornings for career / clarity, not just ‘being up’",
    });
  }

  if (
    blob.includes("journal") ||
    blob.includes("overthink") ||
    blob.includes("anxiety")
  ) {
    add({
      key: "journal",
      label: "Journal",
      description: "5–10 min morning dump",
      reason: "You described night noise that needs a landing spot",
    });
  }

  if (blob.includes("read") && !blob.includes("already")) {
    add({
      key: "reading",
      label: "Reading",
      description: "Morning reading session",
      reason: "You asked for mind fuel, not more scrolling",
    });
  }

  if (
    blob.includes("quran") ||
    blob.includes("prayer") ||
    blob.includes("faith") ||
    blob.includes("fajr")
  ) {
    add({
      key: "fajr",
      label: "Fajr",
      description: "Pray Fajr on time",
      reason: "You tied mornings to prayer",
    });
  }

  if (blob.includes("make bed") || blob.includes("stick") || blob.includes("tiny")) {
    add({
      key: "makeBed",
      label: "Make bed",
      description: "Make bed right after waking",
      reason: "Tiny win when bigger routines already failed",
    });
  }

  const max = answers.failedBefore?.toLowerCase().includes("too many") ? 3 : 4;
  return out.slice(0, max);
}

export function pickFocusKey(
  answers: Record<string, string>,
  locked: PrescribedHabit[]
) {
  const focus = (answers.nonNegotiable || answers.firstMinutes || "").toLowerCase();
  if (focus.includes("phone") && locked.some((h) => h.key === "noPhone")) {
    return "noPhone";
  }
  if (focus.includes("sleep") && locked.some((h) => h.key === "sleepEarly")) {
    return "sleepEarly";
  }
  if (
    (focus.includes("move") || focus.includes("body") || focus.includes("gym")) &&
    locked.some((h) => h.key === "gym")
  ) {
    return "gym";
  }
  if (focus.includes("deep") && locked.some((h) => h.key === "deepWork")) {
    return "deepWork";
  }
  return locked.find((h) => h.key === "wakeEarly")?.key || locked[0]?.key || "wakeEarly";
}

/** Create / reactivate habits so they show on Today. */
export async function lockHabitsForUser(
  userId: string,
  habits: PrescribedHabit[],
  focusKey: string
) {
  const locked: PrescribedHabit[] = [];

  for (const h of habits) {
    const key = slugifyHabitKey(h.key).slice(0, 40);
    const existing = await prisma.habit.findUnique({
      where: { userId_key: { userId, key } },
    });
    if (existing) {
      if (!existing.active) {
        await prisma.habit.update({
          where: { id: existing.id },
          data: {
            active: true,
            label: h.label || existing.label,
            description: h.description || existing.description,
          },
        });
      }
      locked.push(h);
      continue;
    }
    const maxSort = await prisma.habit.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });
    await prisma.habit.create({
      data: {
        userId,
        key,
        label: h.label,
        description: h.description,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        isDefault: false,
        active: true,
      },
    });
    locked.push(h);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { focusHabitKey: focusKey.slice(0, 40) },
  });

  return locked;
}
