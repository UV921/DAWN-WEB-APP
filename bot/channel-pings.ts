/**
 * User-authored channel pings.
 *
 * Each user can define nudges in Settings → Bot messages ("keep studying" at
 * 19:00, and so on). We post them into their own Discord channel at the given
 * minute, optionally only on days the linked habit is still unchecked.
 */

import { Client, EmbedBuilder } from "discord.js";
import type { PrismaClient } from "@prisma/client";
import {
  parseBotMessages,
  renderTemplate,
  resolveChannelId,
} from "../src/lib/bot-messages";
import { resolveDisplayName } from "./names";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function parseChecks(raw: string | null | undefined): Record<string, boolean> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

/** Fires once per minute-slot per ping, even though the scheduler polls at 20s. */
const fired = new Map<string, string>();

export async function postChannelPings(client: Client, prisma: PrismaClient) {
  const now = nowHHMM();
  const today = todayStr();
  const slot = `${today} ${now}`;
  let sent = 0;

  const users = await prisma.user.findMany({
    where: { NOT: { botMessagesJson: "{}" } },
  });

  for (const u of users) {
    const pings = parseBotMessages(u.botMessagesJson).channelPings.filter(
      (p) => p.enabled && p.time === now && fired.get(`${u.id}:${p.id}`) !== slot
    );
    if (pings.length === 0) continue;

    let checks: Record<string, boolean> | null = null;
    let goalText: string | null = null;

    for (const ping of pings) {
      const channelId = resolveChannelId(ping.channelId, u.discordChannelId);
      if (!channelId) continue;

      if (ping.habitKey) {
        if (checks === null) {
          const log = await prisma.habitLog.findUnique({
            where: { userId_date: { userId: u.id, date: today } },
            select: { checks: true },
          });
          checks = parseChecks(log?.checks);
        }
        if (checks[ping.habitKey]) continue;
      }

      if (goalText === null) {
        const plan = await prisma.dayPlan.findUnique({
          where: { userId_date: { userId: u.id, date: today } },
          select: { goalText: true },
        });
        goalText = plan?.goalText || "";
      }

      const name = await resolveDisplayName(client, prisma, u);
      const body = renderTemplate(ping.text, {
        name: `**${name}**`,
        wake: u.wakeGoal,
        sleep: u.sleepGoal,
        goal: goalText,
        streak: u.consistencyStreak,
      });

      try {
        const channel = await client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased() || !("send" in channel)) continue;
        await channel.send({
          content: u.discordId ? `<@${u.discordId}>` : "",
          embeds: [
            new EmbedBuilder()
              .setColor(0xf0b45a)
              .setTitle(ping.label)
              .setDescription(body),
          ],
        });
        fired.set(`${u.id}:${ping.id}`, slot);
        sent += 1;
      } catch (e) {
        console.error("Channel ping failed", u.id, ping.id, e);
      }
    }
  }

  return { sent };
}
