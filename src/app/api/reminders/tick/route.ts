import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processDueReminders } from "@/lib/reminders";
import { reminderDiscordSender } from "@/lib/discord-notify";

/**
 * Fire due Discord reminders.
 * - Authed user: their Discord reminders
 * - Bot/cron with REMINDER_TICK_SECRET: everyone
 */
export async function POST(req: Request) {
  const secret = process.env.REMINDER_TICK_SECRET?.trim();
  const authHeader = req.headers.get("authorization") || "";
  const isCron =
    Boolean(secret) &&
    (authHeader === `Bearer ${secret}` ||
      new URL(req.url).searchParams.get("secret") === secret);

  if (isCron) {
    const { due, now } = await processDueReminders(prisma, {
      discord: reminderDiscordSender(),
    });
    return NextResponse.json({ ok: true, fired: due.length, now, due });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { due, now } = await processDueReminders(prisma, {
    userId: session.user.id,
    discord: reminderDiscordSender(),
  });

  return NextResponse.json({ ok: true, now, due, fired: due.length });
}
