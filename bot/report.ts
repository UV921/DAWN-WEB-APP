/**
 * Daily consistency report for the tracked Discord channel.
 * Pings people who need focus + detailed per-person breakdown.
 */

import { Client, EmbedBuilder } from "discord.js";
import type { Habit, HabitLog, PrismaClient, Todo, TrackedChannel, User } from "@prisma/client";
import { resolveManyNames } from "./names";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function mergeChecks(log: HabitLog | null | undefined): Record<string, boolean> {
  if (!log) return {};
  try {
    if (log.checks) return JSON.parse(log.checks) as Record<string, boolean>;
  } catch {
    /* ignore */
  }
  return {
    sleepEarly: Boolean(log.sleepEarly),
    noPhone: Boolean(log.noPhone),
    wakeEarly: Boolean(log.wakeEarly),
    gym: Boolean(log.gym),
    reading: Boolean(log.reading),
    quran: Boolean(log.quran),
  };
}

type ReportRow = {
  user: User;
  discordId: string | null;
  displayName: string;
  mention: string;
  wakeTime: string | null;
  wakeEarly: boolean;
  bedtime: string | null;
  goalText: string;
  todos: Todo[];
  todosDone: number;
  todosTotal: number;
  habitsDone: number;
  habitsTotal: number;
  habitLines: string[];
  reviewed: boolean;
  streak: number;
  bestStreak: number;
  xp: number;
  level: number;
  onTrack: boolean;
  reasons: string[];
};

function classify(opts: {

  wakeTime: string | null;
  wakeEarly: boolean;
  todosDone: number;
  todosTotal: number;
  reviewed: boolean;
  streak: number;
}): { onTrack: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const ratio =
    opts.todosTotal > 0 ? opts.todosDone / opts.todosTotal : 1;

  if (!opts.wakeTime) reasons.push("missed wake check-in");
  if (opts.todosTotal === 0) reasons.push("no todos set");
  else if (ratio < 0.5)
    reasons.push(`only ${opts.todosDone}/${opts.todosTotal} todos done`);
  else if (ratio < 1)
    reasons.push(`${opts.todosDone}/${opts.todosTotal} todos done`);
  if (opts.todosTotal > 0 && !opts.reviewed)
    reasons.push("hasn't done night review");

  const woke = Boolean(opts.wakeTime);
  const onTrack = woke && opts.todosTotal > 0 && ratio >= 0.5;

  if (onTrack) {
    return {
      onTrack: true,
      reasons: [
        opts.wakeEarly ? "early wake" : "woke up",
        `todos ${opts.todosDone}/${opts.todosTotal}`,
        opts.reviewed ? "night review done" : "review pending",
        opts.streak > 0 ? `streak ${opts.streak}` : null,
      ].filter(Boolean) as string[],
    };
  }

  return {
    onTrack: false,
    reasons: reasons.length ? reasons : ["off track"],
  };
}

function bar(done: number, total: number) {
  if (total <= 0) return "········ no todos";
  const n = 8;
  const filled = Math.round((done / total) * n);
  return `${"█".repeat(filled)}${"·".repeat(n - filled)} ${done}/${total}`;
}

export async function buildConsistencyReport(
  prisma: PrismaClient,
  tracked: TrackedChannel,
  client: Client,
  opts?: { date?: string; label?: string }
) {
  const date = opts?.date || todayStr();
  const members = await prisma.trackedMember.findMany({
    where: { trackedChannelId: tracked.id },
    include: { user: true },
  });

  const userIds = members.map((m) => m.userId);
  const nameMap = await resolveManyNames(
    client,
    prisma,
    members.map((m) => m.user)
  );

  const logs = await prisma.habitLog.findMany({
    where: { userId: { in: userIds }, date },
  });
  const logMap = Object.fromEntries(logs.map((l) => [l.userId, l]));

  const plans = await prisma.dayPlan.findMany({
    where: { userId: { in: userIds }, date },
  });
  const planMap = Object.fromEntries(plans.map((p) => [p.userId, p]));

  const todos = await prisma.todo.findMany({
    where: { userId: { in: userIds }, date },
    orderBy: { createdAt: "asc" },
  });
  const todosByUser = new Map<string, Todo[]>();
  for (const t of todos) {
    const arr = todosByUser.get(t.userId) || [];
    arr.push(t);
    todosByUser.set(t.userId, arr);
  }

  const habits = await prisma.habit.findMany({
    where: { userId: { in: userIds }, active: true },
    orderBy: { sortOrder: "asc" },
  });
  const habitsByUser = new Map<string, Habit[]>();
  for (const h of habits) {
    const arr = habitsByUser.get(h.userId) || [];
    arr.push(h);
    habitsByUser.set(h.userId, arr);
  }

  const rows: ReportRow[] = members.map((m) => {
    const log = logMap[m.userId] || null;
    const plan = planMap[m.userId];
    const userTodos = todosByUser.get(m.userId) || [];
    const userHabits = habitsByUser.get(m.userId) || [];
    const checks = mergeChecks(log);
    const wakeTime = log?.wakeTime || null;
    const habitLines = userHabits.map((h) => {
      const done =
        Boolean(checks[h.key]) ||
        (h.key === "wakeEarly" && Boolean(wakeTime)) ||
        (h.key === "sleepEarly" && Boolean(log?.bedtime));
      return `${done ? "✅" : "⬜"}${h.label}`;
    });
    const habitsDone = userHabits.filter(
      (h) =>
        Boolean(checks[h.key]) ||
        (h.key === "wakeEarly" && Boolean(wakeTime)) ||
        (h.key === "sleepEarly" && Boolean(log?.bedtime))
    ).length;
    const todosDone = userTodos.filter((t) => t.done).length;
    const todosTotal = userTodos.length || plan?.todosTotal || 0;
    const doneCount =
      userTodos.length > 0 ? todosDone : plan?.todosDone ?? 0;
    const wakeEarly = Boolean(log?.wakeEarly || checks.wakeEarly);
    const reviewed = Boolean(plan?.reviewed);
    const streak = m.user.consistencyStreak;
    const { onTrack, reasons } = classify({
      wakeTime,
      wakeEarly,
      todosDone: doneCount,
      todosTotal,
      reviewed,
      streak,
    });
    const discordId = m.user.discordId;
    const displayName = nameMap.get(m.user.id) || m.user.name || "Member";
    return {
      user: m.user,
      discordId,
      displayName,
      mention: discordId ? `<@${discordId}>` : `**${displayName}**`,
      wakeTime,
      wakeEarly,
      bedtime: log?.bedtime || null,
      goalText: plan?.goalText || "",
      todos: userTodos,
      todosDone: doneCount,
      todosTotal,
      habitsDone,
      habitsTotal: Math.max(userHabits.length, 1),
      habitLines,
      reviewed,
      streak,
      bestStreak: m.user.bestConsistencyStreak,
      xp: m.user.xp,
      level: m.user.level,
      onTrack,
      reasons,
    };
  });

  const onTrack = rows
    .filter((r) => r.onTrack)
    .sort((a, b) => b.streak - a.streak || b.todosDone - a.todosDone);
  const needsFocus = rows
    .filter((r) => !r.onTrack)
    .sort((a, b) => a.streak - b.streak || a.todosDone - b.todosDone);

  const pingIds = needsFocus
    .map((r) => r.discordId)
    .filter((id): id is string => Boolean(id));

  const boardLines = [...onTrack, ...needsFocus].map((r) => {
    const wake = r.wakeTime
      ? `${r.wakeEarly ? "🌅" : "⏰"} ${r.wakeTime}`
      : "⬜ —";
    const mark = r.onTrack ? "✅" : "⚠️";
    return `${mark} **${r.displayName}** · ${wake} · \`${bar(r.todosDone, r.todosTotal)}\` · streak ${r.streak}`;
  });

  const focusWhy = needsFocus.length
    ? needsFocus
        .map((r) => `• **${r.displayName}** — ${r.reasons.slice(0, 2).join(", ")}`)
        .join("\n")
    : null;

  const embed = new EmbedBuilder()
    .setColor(needsFocus.length ? 0xc45c26 : 0x6fbf8a)
    .setTitle(`Dawn · ${date}`)
    .setDescription(
      [
        `**${onTrack.length}/${members.length}** on track`,
        "",
        boardLines.join("\n") || "_No members tracked_",
        focusWhy ? `\n**Why focus**\n${focusWhy}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    )
    .setFooter({ text: `${tracked.name} · wake + ≥50% todos = on track` })
    .setTimestamp(new Date());

  const content =
    pingIds.length > 0
      ? `📊 Report · ${pingIds.map((id) => `<@${id}>`).join(" ")}`
      : `📊 Report · all on track`;

  return {
    content,
    embeds: [embed],
    files: [],
    needsFocus,
    onTrack,
    date,
    pingIds,
  };
}

/** @deprecated use buildConsistencyReport */
export async function buildConsistencyReportEmbed(
  prisma: PrismaClient,
  tracked: TrackedChannel,
  client: Client,
  opts?: { date?: string; label?: string }
) {
  const report = await buildConsistencyReport(prisma, tracked, client, opts);
  return report.embeds[0];
}

async function dmNeedsFocus(
  client: Client,
  rows: ReportRow[],
  date: string,
  channelName: string
) {
  for (const r of rows) {
    if (!r.discordId || r.onTrack) continue;
    try {
      const du = await client.users.fetch(r.discordId);
      await du.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xc45c26)
            .setTitle(`You’re on the focus list · #${channelName}`)
            .setDescription(
              [
                `Hey **${r.displayName}** — the crew report flagged you today.`,
                "",
                `**Why**`,
                r.reasons.map((x) => `• ${x}`).join("\n"),
                "",
                `**Wake** ${r.wakeTime || "not logged"}`,
                `**Todos** ${r.todosDone}/${r.todosTotal}`,
                r.todos.length
                  ? r.todos
                      .map((t) => `${t.done ? "✅" : "⬜"} ${t.text}`)
                      .join("\n")
                  : "_Set todos in the morning flow or `/todo add`_",
                "",
                `Streak **${r.streak}** · ${date}`,
                "",
                "**Do now:** `/todo list` → finish what you can → `/review`",
              ].join("\n")
            ),
        ],
      });
    } catch (e) {
      console.error("Focus DM failed", r.discordId, e);
    }
  }
}

export async function dmFocusMembers(
  client: Client,
  rows: ReportRow[],
  date: string,
  channelName: string
) {
  await dmNeedsFocus(client, rows, date, channelName);
}

export async function postConsistencyReports(
  client: Client,
  prisma: PrismaClient,
  opts?: {
    channelDbId?: string;
    force?: boolean;
    date?: string;
    dmFocus?: boolean;
  }
) {
  const today = todayStr();
  const now = nowHHMM();
  const date = opts?.date || today;

  const channels = opts?.channelDbId
    ? await prisma.trackedChannel.findMany({ where: { id: opts.channelDbId } })
    : await prisma.trackedChannel.findMany();

  let posted = 0;
  for (const ch of channels) {
    const reportTime = ch.reportTime || "21:30";
    const lastReport = ch.lastReportDate;
    const due =
      opts?.force || (reportTime === now && lastReport !== today);
    if (!due) continue;

    try {
      const channel = await client.channels.fetch(ch.channelId);
      if (!channel || !channel.isTextBased() || !("send" in channel)) continue;

      const report = await buildConsistencyReport(prisma, ch, client, {
        date,
        label:
          date === yesterdayStr()
            ? `Yesterday's consistency · ${ch.name}`
            : `Daily consistency · ${ch.name}`,
      });

      await channel.send({
        content: report.content,
        embeds: report.embeds,
        allowedMentions: { users: report.pingIds },
      });

      // No DM spam — channel ping once is enough
      await prisma.trackedChannel.update({
        where: { id: ch.id },
        data: { lastReportDate: today },
      });
      posted += 1;
    } catch (e) {
      console.error("Consistency report failed", ch.channelId, e);
    }
  }

  return { posted, today, now, date };
}

export { yesterdayStr, todayStr as reportTodayStr };
