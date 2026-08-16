/**
 * Daily todos kept in Discord — list / add / toggle for a calendar day.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { PrismaClient, Todo } from "@prisma/client";
import { todayStr } from "./wind-down";
import { syncTodoReminder } from "../src/lib/todo-reminders";

export function formatTodoLines(todos: Todo[]) {
  if (!todos.length) return "_No todos yet — `/todo add` or set them with `/sleep`._";
  const kids = new Map<string, Todo[]>();
  const roots: Todo[] = [];
  const ids = new Set(todos.map((t) => t.id));
  for (const t of todos) {
    if (t.parentId && ids.has(t.parentId)) {
      const arr = kids.get(t.parentId) || [];
      arr.push(t);
      kids.set(t.parentId, arr);
    } else {
      roots.push(t);
    }
  }
  const lines: string[] = [];
  roots.forEach((t, i) => {
    const bang = t.priority === "high" ? " (!)" : "";
    lines.push(`${t.done ? "✅" : "⬜"} **${i + 1}.**${bang} ${t.text}`);
    for (const c of kids.get(t.id) || []) {
      const cbang = c.priority === "high" ? " (!)" : "";
      lines.push(`${c.done ? "✅" : "⬜"} ↳${cbang} ${c.text}`);
    }
  });
  return lines.join("\n");
}

export function todoToggleRows(todos: Todo[]) {
  const open = todos.slice(0, 20);
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < open.length; i += 5) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...open.slice(i, i + 5).map((t, j) => {
          const n = i + j + 1;
          const label = `${t.done ? "✓" : n} ${t.text}`.slice(0, 80);
          return new ButtonBuilder()
            .setCustomId(`td:toggle:${t.id}`)
            .setLabel(label)
            .setStyle(t.done ? ButtonStyle.Success : ButtonStyle.Secondary);
        })
      )
    );
  }
  // Leave room for add row if under 5 rows
  if (rows.length < 5) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("td:add")
          .setLabel("Add todo")
          .setStyle(ButtonStyle.Primary)
      )
    );
  }
  return rows;
}

export function buildTodoEmbed(opts: {
  name: string;
  date: string;
  todos: Todo[];
  goalText?: string | null;
}) {
  const done = opts.todos.filter((t) => t.done).length;
  const total = opts.todos.length;
  return new EmbedBuilder()
    .setColor(0x3d5a80)
    .setTitle(`${opts.name} · todos · ${opts.date}`)
    .setDescription(
      [
        opts.goalText ? `Goal: **${opts.goalText}**` : null,
        total ? `Progress **${done}/${total}**` : null,
        "",
        formatTodoLines(opts.todos),
        "",
        "Tap a button to toggle · `/todo add` anytime",
      ]
        .filter((x) => x !== null)
        .join("\n")
    );
}

export async function listTodosForDate(
  prisma: PrismaClient,
  userId: string,
  date = todayStr()
) {
  return prisma.todo.findMany({
    where: { userId, date },
    orderBy: { createdAt: "asc" },
  });
}

export async function addTodosForDate(
  prisma: PrismaClient,
  opts: { userId: string; date?: string; raw: string }
) {
  const date = opts.date || todayStr();
  const items = opts.raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 15);

  if (!items.length) return { date, items: [] as string[], created: [] as Todo[] };

  await prisma.todo.createMany({
    data: items.map((text) => ({
      userId: opts.userId,
      date,
      text: text.slice(0, 160),
    })),
  });

  const created = await listTodosForDate(prisma, opts.userId, date);
  return { date, items, created };
}

export async function toggleTodo(
  prisma: PrismaClient,
  opts: { todoId: string; discordUserId: string }
) {
  const user = await prisma.user.findFirst({
    where: { discordId: opts.discordUserId },
  });
  if (!user) return null;

  const todo = await prisma.todo.findFirst({
    where: { id: opts.todoId, userId: user.id },
  });
  if (!todo) return null;

  const updated = await prisma.todo.update({
    where: { id: todo.id },
    data: { done: !todo.done },
  });
  await syncTodoReminder(prisma, {
    userId: user.id,
    todo: updated,
    done: updated.done,
  });

  const todos = await listTodosForDate(prisma, user.id, updated.date);
  return { user, todo: updated, todos, date: updated.date };
}

export async function markTodoByIndex(
  prisma: PrismaClient,
  opts: { userId: string; index: number; date?: string; done?: boolean }
) {
  const date = opts.date || todayStr();
  const todos = await listTodosForDate(prisma, opts.userId, date);
  const target = todos[opts.index - 1];
  if (!target) return null;
  const updated = await prisma.todo.update({
    where: { id: target.id },
    data: { done: opts.done ?? !target.done },
  });
  await syncTodoReminder(prisma, {
    userId: opts.userId,
    todo: updated,
    done: updated.done,
  });
  const next = await listTodosForDate(prisma, opts.userId, date);
  return { todo: updated, todos: next, date };
}

export function todayTodoModal() {
  return new ModalBuilder()
    .setCustomId("td_modal_add")
    .setTitle("Add todos for today")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("text")
          .setLabel("Todos (comma or new line)")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500)
          .setPlaceholder("Deep work 2h, Gym, Call mom")
      )
    );
}

export async function getDayPlanGoal(
  prisma: PrismaClient,
  userId: string,
  date: string
) {
  const plan = await prisma.dayPlan.findUnique({
    where: { userId_date: { userId, date } },
  });
  return plan?.goalText || null;
}
