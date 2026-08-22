import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processDueReminders } from "@/lib/reminders";
import { processDueStudyNudges } from "@/lib/study-nudge-send";
import {
  reminderDiscordSender,
  studyNudgeDiscordSender,
} from "@/lib/discord-notify";

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
    const [reminders, study] = await Promise.all([
      processDueReminders(prisma, {
        discord: reminderDiscordSender(),
      }),
      processDueStudyNudges(prisma, {
        discord: studyNudgeDiscordSender(),
      }),
    ]);
    return NextResponse.json({
      ok: true,
      fired: reminders.due.length + study.due.length,
      now: reminders.now,
      due: reminders.due,
      studyDue: study.due,
    });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [reminders, study] = await Promise.all([
    processDueReminders(prisma, {
      userId: session.user.id,
      discord: reminderDiscordSender(),
    }),
    processDueStudyNudges(prisma, {
      userId: session.user.id,
      discord: studyNudgeDiscordSender(),
    }),
  ]);

  return NextResponse.json({
    ok: true,
    now: reminders.now,
    due: reminders.due,
    studyDue: study.due,
    fired: reminders.due.length + study.due.length,
  });
}
