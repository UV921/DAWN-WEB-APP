import { prisma } from "@/lib/prisma";
import { DEFAULT_HABITS } from "@/lib/habits";

/** Ensure user has default habits (sleep/wake early + stack). */
export async function ensureDefaultHabits(userId: string) {
  const existing = await prisma.habit.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
  });
  if (existing.length > 0) {
    return existing.filter((h) => h.active);
  }

  await prisma.habit.createMany({
    data: DEFAULT_HABITS.map((h) => ({
      userId,
      key: h.key,
      label: h.label,
      description: h.description,
      sortOrder: h.sortOrder,
      isDefault: true,
      active: true,
    })),
  });

  return prisma.habit.findMany({
    where: { userId, active: true },
    orderBy: { sortOrder: "asc" },
  });
}
