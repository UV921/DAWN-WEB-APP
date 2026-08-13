import { prisma } from "@/lib/prisma";
import { levelFromXp } from "@/lib/xp";

export async function grantXp(userId: string, amount: number) {
  if (amount <= 0) return null;
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { xp: true },
  });
  const xp = (row?.xp ?? 0) + amount;
  const lvl = levelFromXp(xp);
  await prisma.user.update({
    where: { id: userId },
    data: { xp, level: lvl.level },
  });
  return { xp, gained: amount, ...lvl };
}
