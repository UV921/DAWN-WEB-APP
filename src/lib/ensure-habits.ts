import { prisma } from "@/lib/prisma";
import { DEFAULT_HABITS } from "@/lib/habits";

/** Ensure user has default habits (sleep/wake early + stack). */
export async function ensureDefaultHabits(userId: string) {
  const count = await prisma.habit.count({ where: { userId } });
  if (count > 0) {
    return prisma.habit.findMany({
      where: { userId, active: true },
      orderBy: { sortOrder: "asc" },
    });
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
