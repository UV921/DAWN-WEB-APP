/**
 * Morning DM pings + channel leaderboard
 * - At pingTime: DM every tracked member "Are you awake?"
 * - If they tap I'm awake → log wake in DB (streaks/grid)
 * - If no reply → counted as not awake
 * - At leaderboardTime (or on command): post who woke / habits leaderboard
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
} from "discord.js";
import type { PrismaClient, TrackedChannel, User, HabitLog, Habit } from "@prisma/client";
import { resolveDisplayName, resolveManyNames } from "./names";

type LogLike = HabitLog & { checks?: string | null };

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
    const p = JSON.parse(raw) as Record<string, boolean>;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function mergeChecks(log: LogLike | null): Record<string, boolean> {
  if (!log) return {};
  const fromJson = parseChecks(log.checks);
  return {
    sleepEarly: fromJson.sleepEarly ?? log.sleepEarly,
    noPhone: fromJson.noPhone ?? log.noPhone,
    wakeEarly: fromJson.wakeEarly ?? log.wakeEarly,
    gym: fromJson.gym ?? log.gym,
    reading: fromJson.reading ?? log.reading,
    quran: fromJson.quran ?? log.quran,
    ...fromJson,
  };
}

function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export async function sendMorningDms(
  client: Client,
  prisma: PrismaClient,
  opts?: { channelDbId?: string; force?: boolean }
) {
  const today = todayStr();
  const now = nowHHMM();

  const channels = opts?.channelDbId
    ? await prisma.trackedChannel.findMany({
        where: { id: opts.channelDbId },
        include: {
          members: { include: { user: true } },
        },
      })
    : await prisma.trackedChannel.findMany({
        include: {
          members: { include: { user: true } },
        },
      });

  let sent = 0;
  let skipped = 0;

  for (const ch of channels) {
    const due =
      opts?.force ||
      (ch.pingTime === now && ch.lastPingDate !== today);
    if (!due) continue;

    for (const m of ch.members) {
      const u = m.user;
      if (!u.discordId) {
        skipped += 1;
        continue;
      }
      if (!opts?.force && m.lastPingDate === today) {
        skipped += 1;
        continue;
      }

      try {
        const discordUser = await client.users.fetch(u.discordId);
        const name = await resolveDisplayName(client, prisma, u);
        const todos = await prisma.todo.findMany({
          where: { userId: u.id, date: today },
          orderBy: { createdAt: "asc" },
          take: 8,
        });
        const plan = await prisma.dayPlan.findUnique({
          where: { userId_date: { userId: u.id, date: today } },
        });
        const cons = {
          streak: u.consistencyStreak,
          yesterday: null as string | null,
        };
        {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
          const yPlan = await prisma.dayPlan.findUnique({
            where: { userId_date: { userId: u.id, date: yStr } },
          });
          if (yPlan?.reviewed) {
            cons.yesterday = `${yPlan.todosDone}/${yPlan.todosTotal || 0}`;
          }
        }
        const todoPreview = todos.length
          ? [
              "",
              "**Today's todos**",
              ...todos.map((t) => `${t.done ? "✅" : "⬜"} ${t.text}`),
            ].join("\n")
          : "";

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`wakeack:${ch.id}`)
            .setLabel("I'm awake")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`wakesnooze:${ch.id}`)
            .setLabel("Snoozing")
            .setStyle(ButtonStyle.Secondary)
        );

        await discordUser.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xf0b45a)
              .setTitle(`Good morning · #${ch.name}`)
              .setDescription(
                [
                  `Hey **${name}** — time to check in.`,
                  "",
                  u.whyLine ? `_${u.whyLine}_` : null,
                  `🎯 Wake goal **${u.wakeGoal}**`,
                  `🔥 Consistency streak **${cons.streak}**` +
                    (cons.yesterday ? ` · yesterday todos ${cons.yesterday}` : ""),
                  plan?.goalText ? `📌 Today’s goal: **${plan.goalText}**` : null,
                  "",
                  "**What to do**",
                  "1️⃣ Tap **I'm awake** if you’re up",
                  "2️⃣ Answer: reminder? → time → todos",
                  "3️⃣ Grind the day — night check asks what you finished",
                  "",
                  "No reply = **not awake** on the leaderboard.",
                  todoPreview || null,
                ]
                  .filter(Boolean)
                  .join("\n")
              ),
          ],
          components: [row],
        });

        await prisma.trackedMember.update({
          where: { id: m.id },
          data: { lastPingDate: today },
        });
        sent += 1;
      } catch (e) {
        console.error(`DM failed for ${u.discordId}`, e);
        skipped += 1;
      }
    }

    await prisma.trackedChannel.update({
      where: { id: ch.id },
      data: { lastPingDate: today },
    });
  }

  return { sent, skipped, now, today };
}

export async function recordWakeFromDm(
  prisma: PrismaClient,
  opts: {
    discordUserId: string;
    trackedChannelId: string;
    snooze?: boolean;
  }
) {
  const today = todayStr();
  const time = nowHHMM();

  const member = await prisma.trackedMember.findFirst({
    where: {
      trackedChannelId: opts.trackedChannelId,
      user: { discordId: opts.discordUserId },
    },
    include: { user: true, channel: true },
  });
  if (!member) return { ok: false as const, error: "Join the morning board first (/join)." };

  const user = member.user;
  if (opts.snooze) {
    await prisma.trackedMember.update({
      where: { id: member.id },
      data: { respondedDate: null },
    });
    return {
      ok: true as const,
      snooze: true as const,
      user,
      channel: member.channel,
    };
  }

  const existing = await prisma.habitLog.findUnique({
    where: { userId_date: { userId: user.id, date: today } },
  });
  const checks = mergeChecks(existing);
  const wakeEarly = timeToMin(time) <= timeToMin(user.wakeGoal);
  checks.wakeEarly = wakeEarly;

  await prisma.habitLog.upsert({
    where: { userId_date: { userId: user.id, date: today } },
    create: {
      userId: user.id,
      date: today,
      wakeTime: time,
      checks: JSON.stringify(checks),
      sleepEarly: Boolean(checks.sleepEarly),
      noPhone: Boolean(checks.noPhone),
      wakeEarly,
      gym: Boolean(checks.gym),
      reading: Boolean(checks.reading),
      quran: Boolean(checks.quran),
    },
    update: {
      wakeTime: time,
      checks: JSON.stringify(checks),
      wakeEarly,
    },
  });

  // XP
  let xpGain = 15;
  if (wakeEarly) xpGain += 50;
  const xp = user.xp + xpGain;
  const level = Math.max(1, Math.floor(xp / 100) + 1);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      xp,
      level,
      totalEarlyWakes: user.totalEarlyWakes + (wakeEarly ? 1 : 0),
    },
  });

  await prisma.trackedMember.update({
    where: { id: member.id },
    data: { respondedDate: today },
  });

  const habits = await prisma.habit.findMany({
    where: { userId: user.id, active: true },
    orderBy: { sortOrder: "asc" },
    take: 20,
  });

  return {
    ok: true as const,
    snooze: false as const,
    user,
    channel: member.channel,
    wakeTime: time,
    wakeEarly,
    xpGain,
    habits,
    checks,
  };
}

export async function toggleHabitFromDm(
  prisma: PrismaClient,
  opts: { discordUserId: string; habitKey: string }
) {
  const today = todayStr();
  const user = await prisma.user.findFirst({
    where: { discordId: opts.discordUserId },
  });
  if (!user) return null;

  const habits = await prisma.habit.findMany({
    where: { userId: user.id, active: true },
    orderBy: { sortOrder: "asc" },
  });
  if (!habits.some((h) => h.key === opts.habitKey)) return null;

  const existing = await prisma.habitLog.findUnique({
    where: { userId_date: { userId: user.id, date: today } },
  });
  const checks = mergeChecks(existing);
  checks[opts.habitKey] = !checks[opts.habitKey];

  await prisma.habitLog.upsert({
    where: { userId_date: { userId: user.id, date: today } },
    create: {
      userId: user.id,
      date: today,
      checks: JSON.stringify(checks),
      sleepEarly: Boolean(checks.sleepEarly),
      noPhone: Boolean(checks.noPhone),
      wakeEarly: Boolean(checks.wakeEarly),
      gym: Boolean(checks.gym),
      reading: Boolean(checks.reading),
      quran: Boolean(checks.quran),
    },
    update: {
      checks: JSON.stringify(checks),
      sleepEarly: Boolean(checks.sleepEarly),
      noPhone: Boolean(checks.noPhone),
      wakeEarly: Boolean(checks.wakeEarly),
      gym: Boolean(checks.gym),
      reading: Boolean(checks.reading),
      quran: Boolean(checks.quran),
    },
  });

  return { user, habits, checks, today };
}

type MemberRow = {
  user: User;
  log: LogLike | null;
  habits: Habit[];
  responded: boolean;
};

export async function buildLeaderboardEmbed(
  prisma: PrismaClient,
  tracked: TrackedChannel,
  date = todayStr(),
  client?: Client
) {
  const members = await prisma.trackedMember.findMany({
    where: { trackedChannelId: tracked.id },
    include: { user: true },
  });
  const userIds = members.map((m) => m.userId);
  const logs = await prisma.habitLog.findMany({
    where: { userId: { in: userIds }, date },
  });
  const logMap = Object.fromEntries(logs.map((l) => [l.userId, l]));
  const allHabits = await prisma.habit.findMany({
    where: { userId: { in: userIds }, active: true },
  });
  const habitsByUser = new Map<string, Habit[]>();
  for (const h of allHabits) {
    const arr = habitsByUser.get(h.userId) || [];
    arr.push(h);
    habitsByUser.set(h.userId, arr);
  }

  const nameMap = client
    ? await resolveManyNames(
        client,
        prisma,
        members.map((m) => m.user)
      )
    : new Map(members.map((m) => [m.user.id, m.user.name || "Member"]));

  const rows: MemberRow[] = members.map((m) => ({
    user: m.user,
    log: logMap[m.userId] || null,
    habits: habitsByUser.get(m.userId) || [],
    responded: m.respondedDate === date || Boolean(logMap[m.userId]?.wakeTime),
  }));

  const scored = rows.map((r) => {
    const checks = mergeChecks(r.log);
    const done = r.habits.filter((h) => checks[h.key]).length;
    const total = Math.max(r.habits.length, 1);
    const wakeEarly = Boolean(checks.wakeEarly || r.log?.wakeEarly);
    const wakeTime = r.log?.wakeTime || null;
    const displayName = nameMap.get(r.user.id) || r.user.name || "Member";
    return { ...r, done, total, wakeEarly, wakeTime, checks, displayName };
  });

  scored.sort((a, b) => {
    const aScore =
      (a.responded ? 1000 : 0) +
      (a.wakeEarly ? 500 : 0) +
      (a.wakeTime ? 1000 - timeToMin(a.wakeTime) : 0) +
      a.done * 10 +
      a.user.xp / 1000;
    const bScore =
      (b.responded ? 1000 : 0) +
      (b.wakeEarly ? 500 : 0) +
      (b.wakeTime ? 1000 - timeToMin(b.wakeTime) : 0) +
      b.done * 10 +
      b.user.xp / 1000;
    return bScore - aScore;
  });

  const awake = scored.filter((r) => r.responded && r.wakeTime);
  const asleep = scored.filter((r) => !r.responded || !r.wakeTime);

  const medal = ["🥇", "🥈", "🥉"];
  const awakeLines = awake.map((r, i) => {
    const m = medal[i] || `#${i + 1}`;
    const early = r.wakeEarly ? "🌅" : "⏰";
    return `${m} ${early} **${r.displayName}** — wake **${r.wakeTime}** · habits **${r.done}/${r.total}** · Lv ${r.user.level}`;
  });
  const asleepLines = asleep.map(
    (r) => `⬜ **${r.displayName}** — no DM reply yet`
  );

  return new EmbedBuilder()
    .setColor(0xf0b45a)
    .setTitle(`Morning board · ${tracked.name}`)
    .setDescription(
      [
        `📅 **${date}**`,
        "",
        `**Awake (${awake.length})**`,
        awakeLines.join("\n") || "_Nobody tapped I'm awake yet_",
        "",
        `**Not awake (${asleep.length})**`,
        asleepLines.join("\n") || "_Everyone replied_",
        "",
        `_Ping at ${tracked.pingTime} · Board at ${tracked.leaderboardTime} · Report at ${tracked.reportTime || "21:30"}_`,
      ].join("\n")
    )
    .setFooter({ text: "Tap I'm awake in DM to count · /report for graphs" })
    .setTimestamp(new Date());
}

export async function postLeaderboards(
  client: Client,
  prisma: PrismaClient,
  opts?: { channelDbId?: string; force?: boolean }
) {
  const today = todayStr();
  const now = nowHHMM();

  const channels = opts?.channelDbId
    ? await prisma.trackedChannel.findMany({ where: { id: opts.channelDbId } })
    : await prisma.trackedChannel.findMany();

  let posted = 0;
  for (const ch of channels) {
    const due =
      opts?.force ||
      (ch.leaderboardTime === now && ch.lastLeaderboardDate !== today);
    if (!due) continue;

    try {
      const channel = await client.channels.fetch(ch.channelId);
      if (!channel || !channel.isTextBased() || !("send" in channel)) continue;
      const embed = await buildLeaderboardEmbed(prisma, ch, today, client);
      await channel.send({ embeds: [embed] });
      await prisma.trackedChannel.update({
        where: { id: ch.id },
        data: { lastLeaderboardDate: today },
      });
      posted += 1;
    } catch (e) {
      console.error("Leaderboard post failed", ch.channelId, e);
    }
  }
  return { posted, today, now };
}

export function habitDmRows(
  habits: { key: string; label: string }[],
  checks: Record<string, boolean>
) {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const slice = habits.slice(0, 15);
  for (let i = 0; i < slice.length; i += 5) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...slice.slice(i, i + 5).map((h) =>
          new ButtonBuilder()
            .setCustomId(`dmh:${h.key}`)
            .setLabel(h.label.slice(0, 80))
            .setStyle(checks[h.key] ? ButtonStyle.Success : ButtonStyle.Secondary)
        )
      )
    );
  }
  return rows;
}

export async function runMorningScheduler(client: Client, prisma: PrismaClient) {
  const dms = await sendMorningDms(client, prisma);
  const boards = await postLeaderboards(client, prisma);
  if (dms.sent > 0) console.log(`Morning DMs sent: ${dms.sent}`);
  if (boards.posted > 0) console.log(`Leaderboards posted: ${boards.posted}`);
  return { dms, boards };
}
