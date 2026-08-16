/**
 * Morning Q series after "I'm awake" + nightly task review → DB progress.
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
import type { PrismaClient, Todo, User } from "@prisma/client";
import { resolveDisplayName } from "./names";
import {
  isMessageEnabled,
  messageText,
  parseBotMessages,
} from "../src/lib/bot-messages";
import { todayStr, tomorrowStr } from "./wind-down";
import {
  addTodosForDate,
  formatTodoLines,
  listTodosForDate,
} from "./todos";

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function normalizeHHMM(raw: string): string | null {
  const t = raw.trim().replace(".", ":");
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function morningRemindAskRows() {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("mq:remind:yes")
        .setLabel("Yes — set a reminder")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("mq:remind:no")
        .setLabel("No reminder")
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

/** Ask what + custom time (not fixed presets) */
export function morningRemindModal() {
  return new ModalBuilder()
    .setCustomId("mq_modal_remind")
    .setTitle("Today's reminder")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("what")
          .setLabel("What should I remind you about?")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(200)
          .setPlaceholder("e.g. Gym bag · Call dad · Drink water")
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("time")
          .setLabel("What time? (24h HH:MM)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(4)
          .setMaxLength(5)
          .setPlaceholder("e.g. 14:30 or 09:00")
      )
    );
}

export function morningTodoAskRows() {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("mq:todos")
        .setLabel("Add today's todos")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("mq:skip_todos")
        .setLabel("Skip — use existing")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("mq:finish")
        .setLabel("Done for now")
        .setStyle(ButtonStyle.Success)
    ),
  ];
}

export function morningTodosModal() {
  return new ModalBuilder()
    .setCustomId("mq_modal_todos")
    .setTitle("Todos for today")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("text")
          .setLabel("List todos (comma or new line)")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500)
          .setPlaceholder("Deep work, Gym, No phone first hour")
      )
    );
}

export async function consistencySummary(
  prisma: PrismaClient,
  userId: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  const since = new Date();
  since.setDate(since.getDate() - 13);
  const sinceStr = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-${String(since.getDate()).padStart(2, "0")}`;
  const plans = await prisma.dayPlan.findMany({
    where: { userId, date: { gte: sinceStr }, reviewed: true },
    orderBy: { date: "desc" },
  });
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  const y = plans.find((p) => p.date === yStr);
  return {
    streak: user.consistencyStreak,
    best: user.bestConsistencyStreak,
    yesterday: y
      ? `${y.todosDone}/${y.todosTotal || 0}`
      : null,
  };
}

export async function syncDayProgress(
  prisma: PrismaClient,
  userId: string,
  date = todayStr(),
  opts?: { markReviewed?: boolean }
) {
  const todos = await listTodosForDate(prisma, userId, date);
  const todosDone = todos.filter((t) => t.done).length;
  const todosTotal = todos.length;

  await prisma.dayPlan.upsert({
    where: { userId_date: { userId, date } },
    create: {
      userId,
      date,
      todosDone,
      todosTotal,
      reviewed: Boolean(opts?.markReviewed),
    },
    update: {
      todosDone,
      todosTotal,
      ...(opts?.markReviewed ? { reviewed: true } : {}),
    },
  });

  if (opts?.markReviewed) {
    await refreshConsistencyStreak(prisma, userId);
  }

  return { todosDone, todosTotal, todos };
}

async function refreshConsistencyStreak(prisma: PrismaClient, userId: string) {
  // Count consecutive reviewed days ending today or yesterday with ≥50% done (or 0/0 skip)
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 60; i++) {
    const cur = new Date(d);
    cur.setDate(d.getDate() - i);
    const date = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
    const plan = await prisma.dayPlan.findUnique({
      where: { userId_date: { userId, date } },
    });
    if (!plan?.reviewed) {
      if (i === 0) continue; // today not reviewed yet — start from yesterday
      break;
    }
    const ok =
      plan.todosTotal === 0
        ? true
        : plan.todosDone / plan.todosTotal >= 0.5;
    if (!ok) break;
    streak += 1;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return streak;
  await prisma.user.update({
    where: { id: userId },
    data: {
      consistencyStreak: streak,
      bestConsistencyStreak: Math.max(user.bestConsistencyStreak, streak),
    },
  });
  return streak;
}

export async function saveMorningReminder(
  prisma: PrismaClient,
  discordUserId: string,
  time: string,
  what?: string
) {
  const user = await prisma.user.findFirst({ where: { discordId: discordUserId } });
  if (!user) return null;

  const existing = await prisma.reminder.findFirst({
    where: { userId: user.id, title: "Today focus" },
  });
  const plan = await prisma.dayPlan.findUnique({
    where: { userId_date: { userId: user.id, date: todayStr() } },
  });
  const message =
    (what && what.trim()) ||
    (plan?.goalText ? `Focus check · ${plan.goalText}` : null) ||
    "Dawn reminder — stay on your todos.";

  if (existing) {
    await prisma.reminder.update({
      where: { id: existing.id },
      data: {
        time,
        enabled: true,
        notifyBrowser: true,
        notifyDiscord: true,
        discordTarget: "dm",
        message: message.slice(0, 280),
        title: "Today focus",
      },
    });
  } else {
    await prisma.reminder.create({
      data: {
        userId: user.id,
        title: "Today focus",
        message: message.slice(0, 280),
        time,
        enabled: true,
        notifyBrowser: true,
        notifyDiscord: true,
        discordTarget: "dm",
      },
    });
  }
  return { user, time, message: message.slice(0, 280) };
}

export async function addMorningTodos(
  prisma: PrismaClient,
  userId: string,
  raw: string
) {
  return addTodosForDate(prisma, { userId, date: todayStr(), raw });
}

export function nightReviewStartRows() {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("nr:yes")
        .setLabel("Yes — mark which ones")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("nr:none")
        .setLabel("None completed")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("nr:skip")
        .setLabel("Skip review")
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

export function nightReviewTodoRows(todos: Todo[]) {
  const remapped: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < todos.length && remapped.length < 4; i += 5) {
    remapped.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...todos.slice(i, i + 5).map((t, j) => {
          const n = i + j + 1;
          return new ButtonBuilder()
            .setCustomId(`nr:toggle:${t.id}`)
            .setLabel(`${t.done ? "✓" : n} ${t.text}`.slice(0, 80))
            .setStyle(t.done ? ButtonStyle.Success : ButtonStyle.Secondary);
        })
      )
    );
  }
  remapped.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("nr:all")
        .setLabel("Mark all done")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("nr:finish")
        .setLabel("Save progress")
        .setStyle(ButtonStyle.Primary)
    )
  );
  return remapped;
}

export async function sendNightReviewDms(
  client: Client,
  prisma: PrismaClient,
  opts?: { forceUserId?: string; force?: boolean }
) {
  const today = todayStr();
  const now = nowHHMM();
  let sent = 0;

  const members = opts?.forceUserId
    ? await prisma.trackedMember.findMany({
        where: { userId: opts.forceUserId },
        include: { user: true, channel: true },
      })
    : await prisma.trackedMember.findMany({
        include: { user: true, channel: true },
      });

  for (const m of members) {
    const u = m.user;
    if (!u.discordId) continue;
    if (!opts?.force && m.lastReviewDate === today) continue;
    if (!opts?.force && m.channel.reviewTime !== now) continue;

    const settings = parseBotMessages(u.botMessagesJson);
    if (!opts?.force && !isMessageEnabled(settings, "nightReview")) continue;

    const todos = await listTodosForDate(prisma, u.id, today);
    const name = await resolveDisplayName(client, prisma, u);
    const cons = await consistencySummary(prisma, u.id);

    try {
      const du = await client.users.fetch(u.discordId);
      await du.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3d5a80)
            .setTitle("Night check-in")
            .setDescription(
              [
                messageText(settings, "nightReview", {
                  name: `**${name}**`,
                  wake: u.wakeGoal,
                  sleep: u.sleepGoal,
                  streak: cons?.streak,
                }),
                cons
                  ? `Consistency streak **${cons.streak}** day(s)` +
                    (cons.yesterday ? ` · yesterday ${cons.yesterday}` : "")
                  : null,
                "",
                "**Today's todos**",
                formatTodoLines(todos),
              ]
                .filter(Boolean)
                .join("\n")
            ),
        ],
        components: nightReviewStartRows(),
      });
      await prisma.trackedMember.update({
        where: { id: m.id },
        data: { lastReviewDate: today },
      });
      sent += 1;
    } catch (e) {
      console.error("Night review DM failed", u.discordId, e);
    }
  }

  return { sent };
}

export async function finishNightReview(
  prisma: PrismaClient,
  user: User,
  date = todayStr()
) {
  const progress = await syncDayProgress(prisma, user.id, date, {
    markReviewed: true,
  });
  const refreshed = await prisma.user.findUnique({ where: { id: user.id } });
  return {
    ...progress,
    streak: refreshed?.consistencyStreak ?? 0,
    best: refreshed?.bestConsistencyStreak ?? 0,
  };
}

export { tomorrowStr, todayStr };
