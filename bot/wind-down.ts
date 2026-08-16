/**
 * Wind-down / before-sleep DM flow
 * Asks: tomorrow wake time, tomorrow goal, set reminder, add todos
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { PrismaClient } from "@prisma/client";
import { resolveDisplayName } from "./names";
import {
  isMessageEnabled,
  messageText,
  parseBotMessages,
} from "../src/lib/bot-messages";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const WAKE_OPTS = ["05:00", "05:30", "06:00", "06:30", "07:00", "07:30", "08:00"];

export function windDownStartRows() {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("wd:start")
        .setLabel("Yes — plan tomorrow")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("wd:skip")
        .setLabel("Skip tonight")
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

export function tomorrowWakeRows() {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < WAKE_OPTS.length; i += 4) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...WAKE_OPTS.slice(i, i + 4).map((t) =>
          new ButtonBuilder()
            .setCustomId(`wd:wake:${t}`)
            .setLabel(t)
            .setStyle(ButtonStyle.Secondary)
        )
      )
    );
  }
  return rows;
}

export function afterWakeChoiceRows() {
  // Discord max 5 buttons per row — split across 2 rows
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("wd:goal")
        .setLabel("Set tomorrow's goal")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("wd:todos")
        .setLabel("Add todos")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("wd:remind")
        .setLabel("Set wake reminder")
        .setStyle(ButtonStyle.Success)
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("wd:done")
        .setLabel("Done — good night")
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

export async function sendWindDownDms(
  client: Client,
  prisma: PrismaClient,
  opts?: { forceUserId?: string; force?: boolean }
) {
  const today = todayStr();
  const now = nowHHMM();
  let sent = 0;

  if (opts?.forceUserId) {
    const user = await prisma.user.findUnique({ where: { id: opts.forceUserId } });
    if (!user?.discordId) return { sent: 0 };
    const name = await resolveDisplayName(client, prisma, user);
    try {
      const du = await client.users.fetch(user.discordId);
      await du.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3d5a80)
            .setTitle("Wind-down")
            .setDescription(
              `Hey **${name}** — before you sleep:\nWhat time will you wake tomorrow? What's the goal? Todos?`
            ),
        ],
        components: windDownStartRows(),
      });
      sent = 1;
    } catch (e) {
      console.error("Wind-down DM failed", e);
    }
    return { sent };
  }

  const members = await prisma.trackedMember.findMany({
    include: { user: true },
  });

  for (const m of members) {
    const u = m.user;
    if (!u.discordId) continue;
    if (!opts?.force && m.lastWindDownDate === today) continue;
    // Fire at user's sleep goal minute
    if (!opts?.force && u.sleepGoal !== now) continue;

    const settings = parseBotMessages(u.botMessagesJson);
    if (!opts?.force && !isMessageEnabled(settings, "windDown")) continue;

    const name = await resolveDisplayName(client, prisma, u);
    try {
      const du = await client.users.fetch(u.discordId);
      await du.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3d5a80)
            .setTitle("Before you sleep")
            .setDescription(
              messageText(settings, "windDown", {
                name: `**${name}**`,
                wake: `**${u.wakeGoal}**`,
                sleep: `**${u.sleepGoal}**`,
              })
            ),
        ],
        components: windDownStartRows(),
      });
      await prisma.trackedMember.update({
        where: { id: m.id },
        data: { lastWindDownDate: today },
      });
      sent += 1;
    } catch (e) {
      console.error("Wind-down DM failed", u.discordId, e);
    }
  }

  return { sent };
}

export async function saveTomorrowWake(
  prisma: PrismaClient,
  discordUserId: string,
  wakeTime: string
) {
  const user = await prisma.user.findFirst({ where: { discordId: discordUserId } });
  if (!user) return null;
  const date = tomorrowStr();

  await prisma.dayPlan.upsert({
    where: { userId_date: { userId: user.id, date } },
    create: { userId: user.id, date, wakeGoal: wakeTime },
    update: { wakeGoal: wakeTime },
  });

  // Also update their ongoing wake goal
  await prisma.user.update({
    where: { id: user.id },
    data: { wakeGoal: wakeTime },
  });

  return { user, date, wakeTime };
}

export async function saveTomorrowGoal(
  prisma: PrismaClient,
  discordUserId: string,
  goalText: string
) {
  const user = await prisma.user.findFirst({ where: { discordId: discordUserId } });
  if (!user) return null;
  const date = tomorrowStr();
  await prisma.dayPlan.upsert({
    where: { userId_date: { userId: user.id, date } },
    create: { userId: user.id, date, goalText: goalText.slice(0, 240) },
    update: { goalText: goalText.slice(0, 240) },
  });
  return { user, date, goalText };
}

export async function saveTodos(
  prisma: PrismaClient,
  discordUserId: string,
  raw: string
) {
  const user = await prisma.user.findFirst({ where: { discordId: discordUserId } });
  if (!user) return null;
  const date = tomorrowStr();
  const items = raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);

  if (items.length) {
    await prisma.todo.createMany({
      data: items.map((text) => ({
        userId: user.id,
        date,
        text: text.slice(0, 160),
      })),
    });
  }
  return { user, date, items };
}

export async function setWakeReminder(
  prisma: PrismaClient,
  discordUserId: string
) {
  const user = await prisma.user.findFirst({ where: { discordId: discordUserId } });
  if (!user) return null;
  const date = tomorrowStr();
  const plan = await prisma.dayPlan.findUnique({
    where: { userId_date: { userId: user.id, date } },
  });
  const time = plan?.wakeGoal || user.wakeGoal;

  // Upsert a browser+discord reminder at that time
  const existing = await prisma.reminder.findFirst({
    where: { userId: user.id, title: "Tomorrow wake" },
  });
  if (existing) {
    await prisma.reminder.update({
      where: { id: existing.id },
      data: {
        time,
        enabled: true,
        notifyBrowser: true,
        notifyDiscord: true,
        discordTarget: "dm",
        message: plan?.goalText
          ? `Wake up · Goal: ${plan.goalText}`
          : "Time to wake — tap into Dawn.",
      },
    });
  } else {
    await prisma.reminder.create({
      data: {
        userId: user.id,
        title: "Tomorrow wake",
        message: plan?.goalText
          ? `Wake up · Goal: ${plan.goalText}`
          : "Time to wake — tap into Dawn.",
        time,
        enabled: true,
        notifyBrowser: true,
        notifyDiscord: true,
        discordTarget: "dm",
      },
    });
  }
  return { user, time, date };
}

export async function getTomorrowSummary(
  prisma: PrismaClient,
  discordUserId: string
) {
  const user = await prisma.user.findFirst({ where: { discordId: discordUserId } });
  if (!user) return null;
  const date = tomorrowStr();
  const plan = await prisma.dayPlan.findUnique({
    where: { userId_date: { userId: user.id, date } },
  });
  const todos = await prisma.todo.findMany({
    where: { userId: user.id, date },
    orderBy: { createdAt: "asc" },
  });
  return { user, date, plan, todos };
}

export function goalModal() {
  return new ModalBuilder()
    .setCustomId("wd_modal_goal")
    .setTitle("Tomorrow's main goal")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("text")
          .setLabel("One clear goal for tomorrow")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(200)
          .setPlaceholder("e.g. Gym before 8 + 10 pages Quran")
      )
    );
}

export function todosModal() {
  return new ModalBuilder()
    .setCustomId("wd_modal_todos")
    .setTitle("Todos for tomorrow")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("text")
          .setLabel("List todos (comma or new line)")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500)
          .setPlaceholder("Make bed, No phone 30m, Read 10 pages")
      )
    );
}

export { tomorrowStr, todayStr };
