import { prisma } from "@/lib/prisma";

/** Closed + in-progress study minutes per user (week + all-time). */
export async function studyMinutesByUser(
  userIds: string[],
  weekStart: string
): Promise<{ week: Map<string, number>; total: Map<string, number> }> {
  const week = new Map<string, number>();
  const total = new Map<string, number>();
  if (userIds.length === 0) return { week, total };

  const [weekRows, allRows, openSessions] = await Promise.all([
    prisma.studySession.groupBy({
      by: ["userId"],
      where: {
        userId: { in: userIds },
        endedAt: { not: null },
        date: { gte: weekStart },
      },
      _sum: { minutes: true },
    }),
    prisma.studySession.groupBy({
      by: ["userId"],
      where: {
        userId: { in: userIds },
        endedAt: { not: null },
      },
      _sum: { minutes: true },
    }),
    prisma.studySession.findMany({
      where: { userId: { in: userIds }, endedAt: null },
      select: { userId: true, startedAt: true, date: true },
    }),
  ]);

  for (const r of weekRows) week.set(r.userId, r._sum.minutes || 0);
  for (const r of allRows) total.set(r.userId, r._sum.minutes || 0);

  const now = Date.now();
  for (const s of openSessions) {
    const extra = Math.max(
      0,
      Math.round((now - s.startedAt.getTime()) / 60_000)
    );
    total.set(s.userId, (total.get(s.userId) || 0) + extra);
    if (s.date >= weekStart) {
      week.set(s.userId, (week.get(s.userId) || 0) + extra);
    }
  }

  return { week, total };
}
