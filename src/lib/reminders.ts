import type { PrismaClient, Reminder, User } from "@prisma/client";
import { normChannelId } from "./bot-messages";
import { sendWebPushToUser, type WebPushSendResult } from "./web-push";

export type ReminderFireResult = {
  reminderId: string;
  discord: { channel?: boolean; dm?: boolean; error?: string };
  push?: WebPushSendResult;
};

function hhmmNow(timezone?: string): string {
  try {
    if (timezone) {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(new Date());
      const h = parts.find((p) => p.type === "hour")?.value || "00";
      const m = parts.find((p) => p.type === "minute")?.value || "00";
      return `${h}:${m}`;
    }
  } catch {
    /* fall through */
  }
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function dateKeyNow(timezone?: string): string {
  try {
    if (timezone) {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());
      const y = parts.find((p) => p.type === "year")?.value;
      const m = parts.find((p) => p.type === "month")?.value;
      const d = parts.find((p) => p.type === "day")?.value;
      if (y && m && d) return `${y}-${m}-${d}`;
    }
  } catch {
    /* fall through */
  }
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function reminderFireKey(timezone?: string) {
  const date = dateKeyNow(timezone);
  const time = hhmmNow(timezone);
  return { date, time, key: `${date}-${time}` };
}

type DiscordSender = {
  sendChannel: (
    channelId: string,
    title: string,
    body: string
  ) => Promise<{ ok: boolean; error?: string }>;
  sendDm: (
    discordUserId: string,
    title: string,
    body: string
  ) => Promise<{ ok: boolean; error?: string }>;
};

async function resolveChannelId(
  prisma: PrismaClient,
  user: User,
  reminder: Reminder
): Promise<string | null> {
  const fromReminder = normChannelId(reminder.discordChannelId);
  if (fromReminder) return fromReminder;
  const fromUser = normChannelId(user.discordChannelId);
  if (fromUser) return fromUser;
  const membership = await prisma.circleMember.findFirst({
    where: { userId: user.id },
    include: { circle: true },
  });
  const fromCircle = normChannelId(membership?.circle.discordChannelId);
  if (fromCircle) return fromCircle;
  return normChannelId(process.env.DISCORD_CHANNEL_ID) || null;
}

async function resolveDiscordId(
  prisma: PrismaClient,
  user: User
): Promise<string | null> {
  if (user.discordId) return user.discordId;
  const account = await prisma.account.findFirst({
    where: { userId: user.id, provider: "discord" },
  });
  return account?.providerAccountId || null;
}

/** Claim + send Discord reminders that are due this minute. */
export async function processDueReminders(
  prisma: PrismaClient,
  opts: {
    userId?: string;
    discord: DiscordSender;
  }
): Promise<{ due: ReminderFireResult[]; now: string }> {
  const { userId, discord } = opts;

  const users = userId
    ? await prisma.user.findMany({ where: { id: userId } })
    : await prisma.user.findMany({
        where: {
          reminders: {
            some: {
              enabled: true,
              OR: [{ notifyDiscord: true }, { notifyBrowser: true }],
            },
          },
        },
      });

  const results: ReminderFireResult[] = [];

  for (const user of users) {
    const { time, key } = reminderFireKey(user.timezone);
    const due = await prisma.reminder.findMany({
      where: {
        userId: user.id,
        enabled: true,
        time,
        AND: [
          { OR: [{ notifyDiscord: true }, { notifyBrowser: true }] },
          { OR: [{ lastFiredKey: null }, { lastFiredKey: { not: key } }] },
        ],
      },
      include: { todo: { select: { done: true, date: true } } },
    });

    const today = dateKeyNow(user.timezone);

    for (const reminder of due) {
      if (
        reminder.todo &&
        (reminder.todo.done || reminder.todo.date !== today)
      ) {
        continue;
      }

      const claimed = await prisma.reminder.updateMany({
        where: {
          id: reminder.id,
          OR: [{ lastFiredKey: null }, { lastFiredKey: { not: key } }],
        },
        data: { lastFiredKey: key },
      });
      if (claimed.count === 0) continue;

      const result: ReminderFireResult = {
        reminderId: reminder.id,
        discord: {},
      };

      const target = reminder.discordTarget || "channel";
      const title = reminder.title || "Dawn reminder";
      const body =
        reminder.message ||
        "Time for your Dawn check-in — open the app and log habits.";

      if (reminder.notifyBrowser) {
        result.push = await sendWebPushToUser(prisma, user.id, {
          title,
          body,
          url: "/dashboard?ritual=1",
          tag: `dawn-${reminder.id}`,
        });
      }

      if (!reminder.notifyDiscord) {
        results.push(result);
        continue;
      }

      if (target === "channel" || target === "both") {
        const channelId = await resolveChannelId(prisma, user, reminder);
        if (channelId) {
          const res = await discord.sendChannel(channelId, title, body);
          result.discord.channel = res.ok;
          if (!res.ok) result.discord.error = res.error;
        } else {
          result.discord.error = "No Discord channel set";
        }
      }

      if (target === "dm" || target === "both") {
        const discordId = await resolveDiscordId(prisma, user);
        if (discordId) {
          const res = await discord.sendDm(discordId, title, body);
          result.discord.dm = res.ok;
          if (!res.ok) {
            result.discord.error = [result.discord.error, res.error]
              .filter(Boolean)
              .join("; ");
          }
        } else {
          result.discord.error = [
            result.discord.error,
            "No Discord account linked",
          ]
            .filter(Boolean)
            .join("; ");
        }
      }

      results.push(result);
    }
  }

  return { due: results, now: hhmmNow() };
}

export async function ensureDefaultGoals(
  prisma: PrismaClient,
  userId: string,
  wakeGoal: string,
  sleepGoal: string
) {
  const count = await prisma.goal.count({ where: { userId } });
  if (count > 0) {
    return prisma.goal.findMany({
      where: { userId, active: true },
      orderBy: { createdAt: "asc" },
    });
  }

  await prisma.goal.createMany({
    data: [
      {
        userId,
        title: "Wake early",
        description: "Be up by your wake goal",
        targetTime: wakeGoal,
        kind: "wake",
      },
      {
        userId,
        title: "Sleep early",
        description: "In bed by your sleep goal",
        targetTime: sleepGoal,
        kind: "sleep",
      },
    ],
  });

  return prisma.goal.findMany({
    where: { userId, active: true },
    orderBy: { createdAt: "asc" },
  });
}
