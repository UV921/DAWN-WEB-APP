import { prisma } from "@/lib/prisma";
import { normChannelId } from "@/lib/bot-messages";
import { formatDiscordApiError } from "@/lib/discord-notify";

type HabitPayload = {
  userName: string;
  date: string;
  wakeTime?: string | null;
  habits: { label: string; done: boolean }[];
  streak: number;
  circleName?: string;
};

/** Post a check-in embed to a Discord channel via the bot token (REST). */
export async function postCheckInToDiscord(
  channelId: string,
  payload: HabitPayload
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    return { ok: false, error: "DISCORD_BOT_TOKEN not set" };
  }
  const id = normChannelId(channelId);
  if (!id) {
    return { ok: false, error: "No channel configured" };
  }

  const done = payload.habits.filter((h) => h.done).length;
  const total = payload.habits.length;
  const lines = payload.habits
    .map((h) => `${h.done ? "✅" : "⬜"} ${h.label}`)
    .join("\n");

  const embed = {
    title: `${payload.userName} checked in`,
    description: lines,
    color: done === total ? 0xe8a54b : 0x3d5a80,
    fields: [
      ...(payload.wakeTime
        ? [{ name: "Wake time", value: payload.wakeTime, inline: true }]
        : []),
      { name: "Habits", value: `${done}/${total}`, inline: true },
      {
        name: "Streak",
        value: `${payload.streak} day${payload.streak === 1 ? "" : "s"}`,
        inline: true,
      },
      ...(payload.circleName
        ? [{ name: "Circle", value: payload.circleName, inline: true }]
        : []),
    ],
    footer: { text: `Dawn · ${payload.date}` },
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(
      `https://discord.com/api/v10/channels/${id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ embeds: [embed] }),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: formatDiscordApiError(text) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function notifyCircleCheckIn(
  userId: string,
  payload: Omit<HabitPayload, "circleName">
) {
  const memberships = await prisma.circleMember.findMany({
    where: { userId },
    include: { circle: true },
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });

  for (const m of memberships) {
    const channelId =
      normChannelId(m.circle.discordChannelId) ||
      normChannelId(user?.discordChannelId) ||
      normChannelId(process.env.DISCORD_CHANNEL_ID);
    if (!channelId) continue;
    await postCheckInToDiscord(channelId, {
      ...payload,
      circleName: m.circle.name,
    });
  }
}
