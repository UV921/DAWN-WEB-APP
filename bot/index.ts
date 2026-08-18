/**
 * Dawn Discord bot
 *
 * /setup /woke /checkin /habit /today /me /streak /focus /why /board
 * /week /grid /track /join /morning /study-room /studied /doing
 * /ping — DM every member now "are you awake?"
 * /leaderboard — post who woke + habit ranks
 *
 * Auto: at channel pingTime → DM all members
 *       at leaderboardTime → post public leaderboard
 *
 * Run: npm run bot
 */

import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  MessageComponentInteraction,
  MessageFlags,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { createServer } from "http";
import { resolve } from "path";
import {
  buildLeaderboardEmbed,
  habitDmRows,
  postLeaderboards,
  recordWakeFromDm,
  runMorningScheduler,
  sendMorningDms,
  toggleHabitFromDm,
} from "./morning-ping";
import {
  buildConsistencyReport,
  postConsistencyReports,
} from "./report";
import { postChannelPings } from "./channel-pings";
import { postScheduledTodoSends } from "./todo-send";
import { resolveDisplayName, resolveManyNames } from "./names";
import {
  afterWakeChoiceRows,
  getTomorrowSummary,
  goalModal,
  saveTodos,
  saveTomorrowGoal,
  saveTomorrowWake,
  sendWindDownDms,
  setWakeReminder,
  todosModal,
  tomorrowWakeRows,
} from "./wind-down";
import { normChannelId } from "../src/lib/bot-messages";
import {
  addTodosForDate,
  buildTodoEmbed,
  formatTodoLines,
  getDayPlanGoal,
  listTodosForDate,
  markTodoByIndex,
  todayTodoModal,
  todoToggleRows,
  toggleTodo,
} from "./todos";
import {
  consistencySummary,
  finishNightReview,
  morningRemindAskRows,
  morningRemindModal,
  morningTodoAskRows,
  morningTodosModal,
  nightReviewTodoRows,
  normalizeHHMM,
  saveMorningReminder,
  sendNightReviewDms,
  syncDayProgress,
} from "./day-flow";
import {
  attachStudyVoice,
  handleDoingCommand,
  handleStudiedCommand,
  handleStudyActivityButton,
  handleStudyActivityModal,
  handleStudyRoomCommand,
  isStudyActivityCustomId,
} from "./study-voice";

(function loadEnv() {
  const p = resolve(process.cwd(), ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
})();

const prisma = new PrismaClient();
const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  console.error("Set DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID in .env");
  process.exit(1);
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error(
    "Set DATABASE_URL on this host (same Neon URL as Vercel). The bot cannot stay online without it."
  );
  process.exit(1);
}

const LEGACY = ["sleepEarly", "noPhone", "wakeEarly", "gym", "reading", "quran"] as const;

type SetupState = {
  why?: string;
  wakeGoal?: string;
  sleepGoal?: string;
  friction?: string;
  focusKey?: string;
  focusLabel?: string;
  identity?: string;
  step: "why" | "wake" | "sleep" | "friction" | "focus" | "identity";
};

const setups = new Map<string, SetupState>();

const WHY_OPTS = [
  { id: "focus", label: "Quiet focus", value: "More quiet focus time before the world starts" },
  { id: "fajr", label: "Prayer / Fajr", value: "Prayer / spiritual start (Fajr)" },
  { id: "gym", label: "Gym", value: "Gym / training consistency" },
  { id: "phone", label: "No phone scroll", value: "Stop wasting mornings on my phone" },
  { id: "control", label: "Feel in control", value: "Feel in control of my day" },
] as const;

const FRICTION_OPTS = [
  { id: "snooze", label: "Snooze", value: "Snooze / can't get out of bed" },
  { id: "phone", label: "Doomscroll", value: "Phone doomscroll first thing" },
  { id: "late", label: "Bed too late", value: "Went to bed too late" },
  { id: "nofirst", label: "No first action", value: "No clear first action" },
  { id: "tired", label: "Inconsistent", value: "Tired / inconsistent sleep" },
] as const;

const FOCUS_OPTS = [
  { id: "wakeEarly", label: "Wake early" },
  { id: "sleepEarly", label: "Sleep early" },
  { id: "noPhone", label: "No phone" },
  { id: "fajr", label: "Fajr" },
  { id: "gym", label: "Gym" },
  { id: "quran", label: "Quran" },
] as const;

const WAKE_TIMES = ["05:00", "05:30", "06:00", "06:30", "07:00", "07:30"];
const SLEEP_TIMES = ["21:30", "22:00", "22:30", "23:00", "23:30", "00:00"];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function slugify(label: string) {
  const parts = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return `habit${Date.now().toString(36)}`;
  return (
    parts[0] +
    parts
      .slice(1)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join("")
  ).slice(0, 40);
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

function mergeLogChecks(log: {
  checks?: string | null;
  sleepEarly?: boolean;
  noPhone?: boolean;
  wakeEarly?: boolean;
  gym?: boolean;
  reading?: boolean;
  quran?: boolean;
} | null): Record<string, boolean> {
  if (!log) return {};
  const merged = { ...parseChecks(log.checks) };
  for (const k of LEGACY) {
    if (merged[k] === undefined && typeof (log as Record<string, unknown>)[k] === "boolean") {
      merged[k] = Boolean((log as Record<string, boolean>)[k]);
    }
  }
  return merged;
}

function legacyFrom(checks: Record<string, boolean>) {
  return {
    sleepEarly: Boolean(checks.sleepEarly),
    noPhone: Boolean(checks.noPhone),
    wakeEarly: Boolean(checks.wakeEarly),
    gym: Boolean(checks.gym),
    reading: Boolean(checks.reading),
    quran: Boolean(checks.quran),
  };
}

function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function isBeforeOrAt(actual: string, goal: string) {
  return timeToMin(actual) <= timeToMin(goal);
}

function xpForLevel(level: number) {
  if (level <= 1) return 0;
  return 80 + (level - 2) * 40;
}

function levelFromXp(xp: number) {
  let level = 1;
  let remaining = Math.max(0, xp);
  while (true) {
    const need = xpForLevel(level + 1);
    if (remaining < need) {
      return { level, intoLevel: remaining, need, progress: need ? remaining / need : 1 };
    }
    remaining -= need;
    level += 1;
    if (level > 99) return { level: 99, intoLevel: remaining, need: 999, progress: 1 };
  }
}

/** Reliable Discord replies for slash / button / modal */
async function respond(
  interaction:
    | ChatInputCommandInteraction
    | ButtonInteraction
    | ModalSubmitInteraction
    | MessageComponentInteraction,
  payload: {
    content?: string;
    embeds?: EmbedBuilder[];
    components?: ActionRowBuilder<ButtonBuilder>[];
    ephemeral?: boolean;
  }
) {
  const data = {
    content: payload.content ?? "",
    embeds: payload.embeds ?? [],
    components: payload.components ?? [],
  };

  try {
    if (interaction.isModalSubmit()) {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ ...data, ephemeral: true });
      } else {
        await interaction.reply({ ...data, ephemeral: true });
      }
      return;
    }
    if (interaction.isMessageComponent()) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(data);
      } else {
        await interaction.update(data);
      }
      return;
    }
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({
        ...data,
        ephemeral: payload.ephemeral ?? true,
      });
    } else {
      await interaction.reply({
        ...data,
        ephemeral: payload.ephemeral ?? true,
      });
    }
  } catch (e) {
    console.error("respond failed", e);
    try {
      if (interaction.isRepliable()) {
        await interaction.followUp({
          content: data.content || "Updated.",
          embeds: data.embeds,
          ephemeral: true,
        });
      }
    } catch {
      /* ignore */
    }
  }
}

async function findOrCreateUser(discordId: string, name: string) {
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { discordId },
        { accounts: { some: { provider: "discord", providerAccountId: discordId } } },
      ],
    },
  });
  if (user) {
    const patch: { discordId?: string; name?: string } = {};
    if (!user.discordId) patch.discordId = discordId;
    if (name && name !== user.name && !/^\d{17,20}$/.test(name)) patch.name = name;
    if (Object.keys(patch).length) {
      try {
        user = await prisma.user.update({
          where: { id: user.id },
          data: patch,
        });
      } catch {
        // unique race on discordId — re-fetch
        user =
          (await prisma.user.findFirst({ where: { discordId } })) || user;
      }
    }
    return user;
  }
  try {
    return await prisma.user.create({
      data: {
        discordId,
        name,
        email: `${discordId}@users.noreply.discord.local`,
      },
    });
  } catch {
    const existing = await prisma.user.findFirst({ where: { discordId } });
    if (existing) return existing;
    throw new Error(`Could not create user for ${discordId}`);
  }
}

/** List habits the user added themselves — never auto-seed a starter pack. */
async function listHabits(userId: string) {
  // Turn off leftover auto-seeded starter habits (gym/quran/etc.)
  await prisma.habit.updateMany({
    where: { userId, isDefault: true, active: true },
    data: { active: false },
  });
  return prisma.habit.findMany({
    where: { userId, active: true },
    orderBy: { sortOrder: "asc" },
  });
}

/** @deprecated alias — does not create defaults anymore */
async function ensureHabits(userId: string) {
  return listHabits(userId);
}

async function enrollInChannel(
  userId: string,
  channelId: string | null,
  guildIdStr: string | null,
  channelName?: string | null
) {
  if (!channelId || !guildIdStr) return null;
  const tracked = await prisma.trackedChannel.upsert({
    where: { channelId },
    create: {
      channelId,
      guildId: guildIdStr,
      name: channelName || "Morning board",
    },
    update: {},
  });
  await prisma.trackedMember.upsert({
    where: {
      trackedChannelId_userId: {
        trackedChannelId: tracked.id,
        userId,
      },
    },
    create: { trackedChannelId: tracked.id, userId },
    update: {},
  });
  const stored = await prisma.user.findUnique({
    where: { id: userId },
    select: { discordChannelId: true },
  });
  if (!normChannelId(stored?.discordChannelId)) {
    await prisma.user.update({
      where: { id: userId },
      data: { discordChannelId: channelId },
    });
  }
  return tracked;
}

/** Enroll every non-bot member who can see this channel (needs Server Members Intent). */
async function syncChannelMembers(
  channelId: string,
  guildIdStr: string,
  channelName?: string
) {
  const tracked = await prisma.trackedChannel.upsert({
    where: { channelId },
    create: {
      channelId,
      guildId: guildIdStr,
      name: channelName || "Morning board",
    },
    update: channelName ? { name: channelName } : {},
  });

  let enrolled = 0;
  try {
    const guild = await client.guilds.fetch(guildIdStr);
    await guild.members.fetch();
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased() || !("permissionsFor" in channel)) {
      const total = await prisma.trackedMember.count({
        where: { trackedChannelId: tracked.id },
      });
      return { tracked, enrolled: 0, total };
    }

    for (const [, member] of guild.members.cache) {
      if (member.user.bot) continue;
      const perms = channel.permissionsFor(member);
      if (!perms?.has(PermissionFlagsBits.ViewChannel)) continue;

      const user = await findOrCreateUser(
        member.user.id,
        member.displayName || member.user.username
      );
      await prisma.trackedMember.upsert({
        where: {
          trackedChannelId_userId: {
            trackedChannelId: tracked.id,
            userId: user.id,
          },
        },
        create: { trackedChannelId: tracked.id, userId: user.id },
        update: {},
      });
      enrolled += 1;
    }
  } catch (e) {
    console.error("syncChannelMembers failed", e);
  }

  const total = await prisma.trackedMember.count({
    where: { trackedChannelId: tracked.id },
  });
  return { tracked, enrolled, total };
}

function boardJoinRows() {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("board:join")
        .setLabel("Join Dawn board")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("board:leave")
        .setLabel("Leave board")
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

async function earlyStreak(userId: string) {
  const logs = await prisma.habitLog.findMany({
    where: { userId },
    orderBy: { date: "asc" },
  });
  const byDate = new Map(
    logs.map((l) => [l.date, Boolean(mergeLogChecks(l).wakeEarly || l.wakeEarly)])
  );
  const today = todayStr();
  let cursor = byDate.get(today) ? today : addDays(today, -1);
  let current = 0;
  while (byDate.get(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  return current;
}

async function perfectStreak(userId: string, habitKeys: string[]) {
  if (!habitKeys.length) return 0;
  const logs = await prisma.habitLog.findMany({
    where: { userId },
    orderBy: { date: "asc" },
  });
  const byDate = new Map(
    logs.map((l) => {
      const c = mergeLogChecks(l);
      return [l.date, habitKeys.every((k) => Boolean(c[k]))];
    })
  );
  const today = todayStr();
  let cursor = byDate.get(today) ? today : addDays(today, -1);
  let current = 0;
  while (byDate.get(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  return current;
}

function habitButtonRows(
  habits: { key: string; label: string }[],
  checks: Record<string, boolean>
) {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const slice = habits.slice(0, 20);
  for (let i = 0; i < slice.length; i += 5) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...slice.slice(i, i + 5).map((h) =>
          new ButtonBuilder()
            .setCustomId(`h:${h.key}`)
            .setLabel(h.label.slice(0, 80))
            .setStyle(checks[h.key] ? ButtonStyle.Success : ButtonStyle.Secondary)
        )
      )
    );
  }
  return rows;
}

function bar(n: number, max: number, width = 10) {
  const filled = Math.round((n / Math.max(max, 1)) * width);
  return "█".repeat(filled) + "░".repeat(Math.max(0, width - filled));
}

function gridCell(score: number, max: number) {
  if (score <= 0) return "⬜";
  const r = score / Math.max(max, 1);
  if (r < 0.34) return "🟩";
  if (r < 0.67) return "🟢";
  return "💛";
}

async function registerCommands() {
  const habit = new SlashCommandBuilder()
    .setName("habit")
    .setDescription("Add, list, remove, or complete a habit")
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Add a habit")
        .addStringOption((o) =>
          o.setName("name").setDescription("Habit name").setRequired(true)
        )
        .addStringOption((o) => o.setName("description").setDescription("Optional note"))
    )
    .addSubcommand((s) => s.setName("list").setDescription("List your habits"))
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Remove a habit")
        .addStringOption((o) =>
          o.setName("name").setDescription("Name or key").setRequired(true)
        )
    )
    .addSubcommand((s) =>
      s
        .setName("done")
        .setDescription("Mark habit done today")
        .addStringOption((o) =>
          o.setName("name").setDescription("Name or key").setRequired(true)
        )
    );

  const commands = [
    new SlashCommandBuilder()
      .setName("setup")
      .setDescription("Answer Dawn setup questions (buttons)"),
    new SlashCommandBuilder()
      .setName("woke")
      .setDescription("Log wake time + XP")
      .addStringOption((o) =>
        o.setName("time").setDescription("HH:MM (optional)")
      ),
    new SlashCommandBuilder()
      .setName("checkin")
      .setDescription("Toggle your habits"),
    habit,
    new SlashCommandBuilder().setName("today").setDescription("Your morning card"),
    new SlashCommandBuilder().setName("me").setDescription("Profile / XP / why"),
    new SlashCommandBuilder().setName("why").setDescription("Show your why"),
    new SlashCommandBuilder().setName("streak").setDescription("Early + perfect streaks"),
    new SlashCommandBuilder()
      .setName("focus")
      .setDescription("Set 14-day focus habit")
      .addStringOption((o) =>
        o.setName("name").setDescription("Habit name").setRequired(true)
      ),
    new SlashCommandBuilder().setName("board").setDescription("Friend circle board"),
    new SlashCommandBuilder()
      .setName("week")
      .setDescription("7-day wake times + habit bars (your graph)"),
    new SlashCommandBuilder()
      .setName("grid")
      .setDescription("4-week contribution grid"),
    new SlashCommandBuilder()
      .setName("track")
      .setDescription("Use THIS channel as the shared morning board")
      .addStringOption((o) =>
        o
          .setName("ping_time")
          .setDescription("When to DM everyone (HH:MM), default 06:00")
      )
      .addStringOption((o) =>
        o
          .setName("board_time")
          .setDescription("When to post leaderboard (HH:MM), default 08:00")
      )
      .addStringOption((o) =>
        o
          .setName("review_time")
          .setDescription("Nightly task review DM (HH:MM), default 21:00")
      )
      .addStringOption((o) =>
        o
          .setName("report_time")
          .setDescription("Daily consistency report in channel (HH:MM), default 21:30")
      ),
    new SlashCommandBuilder()
      .setName("morning")
      .setDescription("Who woke early today in this channel"),
    new SlashCommandBuilder()
      .setName("join")
      .setDescription("Join this channel's morning tracker"),
    new SlashCommandBuilder()
      .setName("ping")
      .setDescription("DM every member now: are you awake?"),
    new SlashCommandBuilder()
      .setName("leaderboard")
      .setDescription("Post today's wake + habits leaderboard in this channel"),
    new SlashCommandBuilder()
      .setName("sleep")
      .setDescription("Wind-down: plan tomorrow wake, goal, reminder, todos"),
    new SlashCommandBuilder()
      .setName("plan")
      .setDescription("Show tomorrow's wake / goal / todos"),
    new SlashCommandBuilder()
      .setName("todo")
      .setDescription("Daily todos kept in Discord")
      .addSubcommand((s) =>
        s.setName("list").setDescription("Today's todos (toggle in Discord)")
      )
      .addSubcommand((s) =>
        s
          .setName("add")
          .setDescription("Add todo(s) for today")
          .addStringOption((o) =>
            o
              .setName("text")
              .setDescription("One todo, or several separated by commas")
              .setRequired(true)
          )
      )
      .addSubcommand((s) =>
        s
          .setName("done")
          .setDescription("Toggle a todo by its number from /todo list")
          .addIntegerOption((o) =>
            o
              .setName("number")
              .setDescription("Todo number (1, 2, 3…)")
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(30)
          )
      )
      .addSubcommand((s) =>
        s
          .setName("tomorrow")
          .setDescription("Show todos you set for tomorrow (from /sleep)")
      ),
    new SlashCommandBuilder()
      .setName("review")
      .setDescription("Send yourself tonight's task review DM now"),
    new SlashCommandBuilder()
      .setName("report")
      .setDescription("Post today's consistency report (on track vs needs focus)"),
    new SlashCommandBuilder()
      .setName("study-room")
      .setDescription("Mark voice channels Dawn counts as study time")
      .addSubcommand((s) =>
        s
          .setName("add")
          .setDescription("Count this voice channel")
          .addChannelOption((o) =>
            o
              .setName("channel")
              .setDescription("Study voice channel")
              .addChannelTypes(
                ChannelType.GuildVoice,
                ChannelType.GuildStageVoice
              )
              .setRequired(true)
          )
      )
      .addSubcommand((s) =>
        s
          .setName("remove")
          .setDescription("Stop counting this voice channel")
          .addChannelOption((o) =>
            o
              .setName("channel")
              .setDescription("Voice channel to remove")
              .addChannelTypes(
                ChannelType.GuildVoice,
                ChannelType.GuildStageVoice
              )
              .setRequired(true)
          )
      )
      .addSubcommand((s) =>
        s.setName("list").setDescription("List marked study voice channels")
      ),
    new SlashCommandBuilder()
      .setName("studied")
      .setDescription("Your Dawn study hours from marked voice channels"),
    new SlashCommandBuilder()
      .setName("doing")
      .setDescription("Say what you’re doing in this study session")
      .addStringOption((o) =>
        o
          .setName("what")
          .setDescription("Coding, or write it in your words")
      ),
  ].map((c) => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(token!);
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId!, guildId), {
      body: commands,
    });
    console.log("Registered guild slash commands");
  } else {
    await rest.put(Routes.applicationCommands(clientId!), { body: commands });
    console.log("Registered global slash commands");
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

function runJob(name: string, fn: () => Promise<unknown>) {
  void fn().catch((e) => console.error(`${name} failed`, e));
}

const PUBLIC_COMMANDS = new Set([
  "woke",
  "checkin",
  "leaderboard",
  "board",
  "report",
  "ping",
  "week",
  "grid",
]);

async function ackSlash(interaction: ChatInputCommandInteraction) {
  const ephemeral = !PUBLIC_COMMANDS.has(interaction.commandName);
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({
        flags: ephemeral ? MessageFlags.Ephemeral : undefined,
      });
    }
    console.log(
      `[cmd] deferred /${interaction.commandName} ephemeral=${ephemeral}`
    );
  } catch (e) {
    console.error(
      `[cmd] defer-failed /${interaction.commandName} ${errText(e)}`
    );
  }
  const reply = interaction.reply.bind(interaction);
  const edit = interaction.editReply.bind(interaction);
  (
    interaction as ChatInputCommandInteraction & {
      reply: ChatInputCommandInteraction["reply"];
    }
  ).reply = (async (options) => {
    const data =
      typeof options === "string" ? { content: options } : { ...options };
    try {
      if (interaction.deferred || interaction.replied) {
        delete (data as { flags?: unknown }).flags;
        delete (data as { ephemeral?: unknown }).ephemeral;
        return edit(data);
      }
      return reply(options);
    } catch (e) {
      const text =
        typeof options === "string"
          ? options
          : String((data as { content?: string }).content || "Done.");
      console.error(`[cmd] slash-reply-failed ${errText(e)}`);
      await interaction.user.send(text).catch((dm) => {
        console.error(`[cmd] dm-failed ${errText(dm)}`);
      });
      return undefined as never;
    }
  }) as ChatInputCommandInteraction["reply"];
}

client.once("ready", () => {
  const startedAt = new Date().toISOString();
  console.log(`Dawn bot online as ${client.user?.tag}`);
  console.log(`[alive] process up at ${startedAt} — if you do not see this repeating, you are on old logs`);
  setInterval(() => {
    console.log(
      `[alive] ${client.user?.tag || "bot"} since ${startedAt} ready=${client.isReady()}`
    );
  }, 30_000);
  runJob("reminders", () => fireDueReminders());
  runJob("morning", () => runMorningScheduler(client, prisma));
  runJob("wind-down", () => sendWindDownDms(client, prisma));
  runJob("night-review", () => sendNightReviewDms(client, prisma));
  runJob("consistency", () => postConsistencyReports(client, prisma));
  runJob("channel-pings", () => postChannelPings(client, prisma));
  runJob("todo-sends", () => fireScheduledTodoSends());
  setInterval(() => runJob("reminders", () => fireDueReminders()), 30_000);
  setInterval(() => {
    runJob("morning", () => runMorningScheduler(client, prisma));
    runJob("wind-down", () => sendWindDownDms(client, prisma));
    runJob("night-review", () => sendNightReviewDms(client, prisma));
    runJob("consistency", () => postConsistencyReports(client, prisma));
    runJob("channel-pings", () => postChannelPings(client, prisma));
    runJob("todo-sends", () => fireScheduledTodoSends());
  }, 20_000);
});

async function fireScheduledTodoSends() {
  try {
    const { sent } = await postScheduledTodoSends(prisma);
    if (sent) console.log(`Posted ${sent} scheduled task list(s)`);
  } catch (e) {
    console.error("Scheduled todo send failed", e);
  }
}

async function fireDueReminders() {
  try {
    const { processDueReminders } = await import("../src/lib/reminders");
    const { reminderDiscordSender } = await import("../src/lib/discord-notify");
    const { due } = await processDueReminders(prisma, {
      discord: reminderDiscordSender(),
    });
    if (due.length) console.log(`Fired ${due.length} reminder(s)`);
  } catch (e) {
    console.error("Reminder tick failed", e);
  }
}

function describeInteraction(interaction: {
  user: { username: string; id: string };
  guildId: string | null;
  isChatInputCommand(): boolean;
  isButton(): boolean;
  isModalSubmit(): boolean;
  commandName?: string;
  customId?: string;
  options?: ChatInputCommandInteraction["options"];
}): string {
  const who = `${interaction.user.username} (${interaction.user.id})`;
  const where = interaction.guildId || "dm";
  if (interaction.isChatInputCommand()) {
    let name = `/${interaction.commandName}`;
    try {
      const sub = interaction.options.getSubcommand(false);
      if (sub) name += ` ${sub}`;
    } catch {
      /* no subcommand */
    }
    return `${name} user=${who} guild=${where}`;
  }
  if (interaction.isButton()) {
    return `button ${interaction.customId} user=${who} guild=${where}`;
  }
  if (interaction.isModalSubmit()) {
    return `modal ${interaction.customId} user=${who} guild=${where}`;
  }
  return `interaction user=${who} guild=${where}`;
}

function errText(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return String(e);
}

client.on("interactionCreate", async (interaction) => {
  const started = Date.now();
  const label = describeInteraction(interaction);
  console.log(`[cmd] start ${label}`);
  try {
    if (interaction.isChatInputCommand()) {
      await ackSlash(interaction);
      await handleCommand(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModal(interaction);
    } else {
      console.log(`[cmd] ignored ${label}`);
      return;
    }
    const ms = Date.now() - started;
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      console.error(`[cmd] no-reply ${label} ${ms}ms — handler returned without answering Discord`);
      await interaction.reply({
        content: "Dawn got the command but sent no reply. Check Northflank logs for `[cmd]`.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    console.log(`[cmd] ok ${label} ${ms}ms`);
  } catch (e) {
    const ms = Date.now() - started;
    console.error(`[cmd] fail ${label} ${ms}ms ${errText(e)}`);
    console.error(e);
    if (interaction.isRepliable()) {
      const msg = `Dawn hit an error (${errText(e).slice(0, 120)}). Try again.`;
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
        }
      } catch (replyErr) {
        console.error(`[cmd] reply-failed ${label} ${errText(replyErr)}`);
      }
    }
  }
});

function setupWhyRows() {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...WHY_OPTS.slice(0, 3).map((o) =>
      new ButtonBuilder()
        .setCustomId(`su:why:${o.id}`)
        .setLabel(o.label)
        .setStyle(ButtonStyle.Secondary)
    )
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...WHY_OPTS.slice(3).map((o) =>
      new ButtonBuilder()
        .setCustomId(`su:why:${o.id}`)
        .setLabel(o.label)
        .setStyle(ButtonStyle.Secondary)
    ),
    new ButtonBuilder()
      .setCustomId("su:why:other")
      .setLabel("Other…")
      .setStyle(ButtonStyle.Primary)
  );
  return [row1, row2];
}

function timeRows(kind: "wake" | "sleep", times: string[]) {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < times.length; i += 3) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...times.slice(i, i + 3).map((t) =>
          new ButtonBuilder()
            .setCustomId(`su:${kind}:${t}`)
            .setLabel(t)
            .setStyle(ButtonStyle.Secondary)
        )
      )
    );
  }
  return rows;
}

async function showSetupStep(
  interaction:
    | ChatInputCommandInteraction
    | ButtonInteraction
    | ModalSubmitInteraction,
  step: SetupState["step"]
) {
  if (step === "why") {
    await respond(interaction, {
      content: "**Setup 1/6 — Why wake early?**\nTap a button.",
      components: setupWhyRows(),
      ephemeral: true,
    });
    return;
  }
  if (step === "wake") {
    await respond(interaction, {
      content: "**Setup 2/6 — Wake goal (14 days)?**",
      components: timeRows("wake", WAKE_TIMES),
      ephemeral: true,
    });
    return;
  }
  if (step === "sleep") {
    await respond(interaction, {
      content: "**Setup 3/6 — Bedtime that makes that realistic?**",
      components: timeRows("sleep", SLEEP_TIMES),
      ephemeral: true,
    });
    return;
  }
  if (step === "friction") {
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...FRICTION_OPTS.slice(0, 3).map((o) =>
        new ButtonBuilder()
          .setCustomId(`su:fric:${o.id}`)
          .setLabel(o.label)
          .setStyle(ButtonStyle.Secondary)
      )
    );
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...FRICTION_OPTS.slice(3).map((o) =>
        new ButtonBuilder()
          .setCustomId(`su:fric:${o.id}`)
          .setLabel(o.label)
          .setStyle(ButtonStyle.Secondary)
      )
    );
    await respond(interaction, {
      content: "**Setup 4/6 — What kills your morning?**",
      components: [row1, row2],
      ephemeral: true,
    });
    return;
  }
  if (step === "focus") {
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...FOCUS_OPTS.slice(0, 3).map((o) =>
        new ButtonBuilder()
          .setCustomId(`su:focus:${o.id}`)
          .setLabel(o.label)
          .setStyle(ButtonStyle.Secondary)
      )
    );
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...FOCUS_OPTS.slice(3).map((o) =>
        new ButtonBuilder()
          .setCustomId(`su:focus:${o.id}`)
          .setLabel(o.label)
          .setStyle(ButtonStyle.Secondary)
      ),
      new ButtonBuilder()
        .setCustomId("su:focus:custom")
        .setLabel("Custom…")
        .setStyle(ButtonStyle.Primary)
    );
    await respond(interaction, {
      content: "**Setup 5/6 — First habit to lock for 14 days?**",
      components: [row1, row2],
      ephemeral: true,
    });
    return;
  }
  // identity
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("su:id:write")
      .setLabel('Write: "I am someone who…"')
      .setStyle(ButtonStyle.Primary)
  );
  await respond(interaction, {
    content: "**Setup 6/6 — Your identity line**\nTap and finish the sentence.",
    components: [row],
    ephemeral: true,
  });
}

async function completeSetup(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  state: SetupState
) {
  const user = await findOrCreateUser(
    interaction.user.id,
    interaction.user.displayName || interaction.user.username
  );
  await ensureHabits(user.id); // only lists — no starter pack

  const wakeGoal = state.wakeGoal || "06:00";
  const sleepGoal = state.sleepGoal || "22:30";
  const why = state.why || "Own my mornings";
  const identity = state.identity || "wakes early and owns the first hour";
  const focusKey = state.focusKey || "wakeEarly";
  const focusLabel = state.focusLabel || "Wake early";

  // Only create the ONE habit they chose in setup — nothing else
  const existing = await prisma.habit.findUnique({
    where: { userId_key: { userId: user.id, key: focusKey } },
  });
  if (!existing) {
    const maxSort = await prisma.habit.aggregate({
      where: { userId: user.id },
      _max: { sortOrder: true },
    });
    await prisma.habit.create({
      data: {
        userId: user.id,
        key: focusKey,
        label: focusLabel,
        description: "14-day focus",
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        active: true,
      },
    });
  } else {
    await prisma.habit.update({
      where: { id: existing.id },
      data: { active: true, label: focusLabel },
    });
  }

  await prisma.habit.updateMany({
    where: { userId: user.id, key: { in: ["wakeEarly", "sleepEarly"] } },
    data: { active: true },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      onboardingDone: true,
      wakeGoal,
      sleepGoal,
      focusHabitKey: focusKey,
      whyLine: why.slice(0, 240),
      identityLine: identity.slice(0, 120),
      onboardingJson: JSON.stringify(state),
    },
  });

  if ((await prisma.reminder.count({ where: { userId: user.id } })) === 0) {
    await prisma.reminder.createMany({
      data: [
        {
          userId: user.id,
          title: "Wake check-in",
          message: why.slice(0, 100),
          time: wakeGoal,
          enabled: true,
          notifyBrowser: true,
          notifyDiscord: true,
          discordTarget: "channel",
        },
        {
          userId: user.id,
          title: "Wind-down",
          message: "Protect bedtime",
          time: sleepGoal,
          enabled: true,
          notifyBrowser: true,
          notifyDiscord: true,
          discordTarget: "channel",
        },
      ],
    });
  }

  if (interaction.channelId && interaction.guildId) {
    await enrollInChannel(
      user.id,
      interaction.channelId,
      interaction.guildId,
      interaction.channel && "name" in interaction.channel
        ? String(interaction.channel.name)
        : null
    );
  }

  setups.delete(interaction.user.id);

  await respond(interaction, {
    content: "",
    embeds: [
      new EmbedBuilder()
        .setColor(0xf0b45a)
        .setTitle("Setup complete")
        .setDescription(
          [
            `I am someone who **${identity}**`,
            `Why: ${why}`,
            `Wake **${wakeGoal}** · sleep **${sleepGoal}**`,
            `Focus: **${focusLabel}**`,
            "",
            "Next: `/woke` · `/checkin` · `/habit add` · `/morning`",
          ].join("\n")
        ),
    ],
    components: [],
    ephemeral: true,
  });
}

async function buildMorningBoard(trackedId: string, date: string) {
  const tracked = await prisma.trackedChannel.findUnique({
    where: { id: trackedId },
    include: {
      members: { include: { user: true } },
    },
  });
  if (!tracked) return null;

  const userIds = tracked.members.map((m) => m.userId);
  const nameMap = await resolveManyNames(
    client,
    prisma,
    tracked.members.map((m) => m.user)
  );
  const logs = await prisma.habitLog.findMany({
    where: { userId: { in: userIds }, date },
  });
  const logMap = Object.fromEntries(logs.map((l) => [l.userId, l]));
  const allHabits = await prisma.habit.findMany({
    where: { userId: { in: userIds }, active: true },
  });
  const byUser = new Map<string, typeof allHabits>();
  for (const h of allHabits) {
    const arr = byUser.get(h.userId) || [];
    arr.push(h);
    byUser.set(h.userId, arr);
  }

  const early: string[] = [];
  const late: string[] = [];
  const missing: string[] = [];

  for (const m of tracked.members) {
    const u = m.user;
    const name = nameMap.get(u.id) || u.name || "Member";
    const log = logMap[u.id];
    const habits = byUser.get(u.id) || [];
    const checks = mergeLogChecks(log || null);
    const done = habits.filter((h) => checks[h.key]).length;
    const total = Math.max(habits.length, 1);

    if (!log?.wakeTime) {
      missing.push(`⬜ **${name}** — not up yet`);
      continue;
    }
    const earlyHit = Boolean(checks.wakeEarly || log.wakeEarly);
    const line = `${earlyHit ? "🌅" : "⏰"} **${name}** — wake **${log.wakeTime}** · ${done}/${total} habits · Lv ${u.level}`;
    if (earlyHit) early.push(line);
    else late.push(line);
  }

  early.sort();
  late.sort();

  const body = [
    early.length ? `**Early (${early.length})**\n${early.join("\n")}` : null,
    late.length ? `**Logged late (${late.length})**\n${late.join("\n")}` : null,
    missing.length ? `**Not yet (${missing.length})**\n${missing.join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return new EmbedBuilder()
    .setColor(0xf0b45a)
    .setTitle(`${tracked.name} · ${date}`)
    .setDescription(body || "_No members yet — `/join`_")
    .setFooter({ text: `${tracked.members.length} tracking · /woke to check in` });
}

async function handleCommand(interaction: ChatInputCommandInteraction) {
  console.log(`[cmd] db-user /${interaction.commandName}`);
  const user = await findOrCreateUser(
    interaction.user.id,
    interaction.user.displayName || interaction.user.username
  );
  console.log(`[cmd] db-ok user=${user.id} /${interaction.commandName}`);
  const date = todayStr();
  const habits = await ensureHabits(user.id);
  const habitKeys = habits.map((h) => h.key);

  // Auto-enroll when using commands in a guild channel
  if (interaction.guildId && interaction.channelId) {
    const tracked = await prisma.trackedChannel.findUnique({
      where: { channelId: interaction.channelId },
    });
    if (tracked) {
      await enrollInChannel(
        user.id,
        interaction.channelId,
        interaction.guildId
      );
    }
  }

  if (interaction.commandName === "study-room") {
    await handleStudyRoomCommand(prisma, interaction);
    return;
  }

  if (interaction.commandName === "studied") {
    await handleStudiedCommand(prisma, interaction);
    return;
  }

  if (interaction.commandName === "doing") {
    await handleDoingCommand(prisma, interaction);
    return;
  }

  if (interaction.commandName === "setup") {
    setups.set(interaction.user.id, { step: "why" });
    await showSetupStep(interaction, "why");
    return;
  }

  if (interaction.commandName === "track") {
    if (!interaction.guildId || !interaction.channelId) {
      await interaction.reply({
        content: "Use `/track` inside your study channel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const name =
      interaction.channel && "name" in interaction.channel
        ? String(interaction.channel.name)
        : "Morning board";
    const pingTime = interaction.options.getString("ping_time") || "06:00";
    const boardTime = interaction.options.getString("board_time") || "08:00";
    const reviewTime =
      interaction.options.getString("review_time") || "21:00";
    const reportTime =
      interaction.options.getString("report_time") || "21:30";
    if (
      !/^\d{2}:\d{2}$/.test(pingTime) ||
      !/^\d{2}:\d{2}$/.test(boardTime) ||
      !/^\d{2}:\d{2}$/.test(reviewTime) ||
      !/^\d{2}:\d{2}$/.test(reportTime)
    ) {
      await interaction.reply({
        content: "Times must be HH:MM like `06:00`.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }
    const synced = await syncChannelMembers(
      interaction.channelId,
      interaction.guildId,
      name
    );
    await prisma.trackedChannel.update({
      where: { channelId: interaction.channelId },
      data: {
        name,
        pingTime,
        leaderboardTime: boardTime,
        reviewTime,
        reportTime,
      },
    });
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf0b45a)
          .setTitle("Morning board ready")
          .setDescription(
            [
              `Channel **#${name}** is the Dawn board.`,
              `Synced **${synced.enrolled}** members who can see this channel (**${synced.total}** total tracked).`,
              `**${pingTime}** — DM: “Are you awake?”`,
              `After awake → reminder → todos (\`/habit add\` optional).`,
              `**${boardTime}** — wake leaderboard.`,
              `**${reviewTime}** — night task review.`,
              `**${reportTime}** — detailed report + pings.`,
              "",
              "Anyone missed? Tap **Join Dawn board** below.",
              "Then: `/ping` · `/report`",
            ].join("\n")
          ),
      ],
      components: boardJoinRows(),
    });
    return;
  }

  if (interaction.commandName === "join") {
    if (!interaction.guildId || !interaction.channelId) {
      await interaction.reply({
        content: "Use `/join` in the morning channel.",
        ephemeral: true,
      });
      return;
    }
    let tracked = await prisma.trackedChannel.findUnique({
      where: { channelId: interaction.channelId },
    });
    if (!tracked) {
      const name =
        interaction.channel && "name" in interaction.channel
          ? String(interaction.channel.name)
          : "Morning board";
      tracked = await enrollInChannel(
        user.id,
        interaction.channelId,
        interaction.guildId,
        name
      );
    } else {
      await enrollInChannel(
        user.id,
        interaction.channelId,
        interaction.guildId
      );
    }
    await interaction.reply({
      content: `You're on the morning board. Use \`/woke\` when you wake — then \`/morning\` to see the room.`,
      ephemeral: true,
    });
    return;
  }

  if (interaction.commandName === "morning") {
    if (!interaction.channelId) {
      await interaction.reply({
        content: "Use this in a tracked channel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    let tracked = await prisma.trackedChannel.findUnique({
      where: { channelId: interaction.channelId },
    });
    if (!tracked && interaction.guildId) {
      tracked = await enrollInChannel(
        user.id,
        interaction.channelId,
        interaction.guildId,
        interaction.channel && "name" in interaction.channel
          ? String(interaction.channel.name)
          : "Morning board"
      );
    }
    if (!tracked) {
      await interaction.reply({
        content: "Run `/track` in this channel first.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const embed = await buildLeaderboardEmbed(prisma, tracked, date, client);
    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (interaction.commandName === "ping") {
    if (!interaction.channelId) {
      await interaction.reply({
        content: "Use `/ping` in the morning channel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const tracked = await prisma.trackedChannel.findUnique({
      where: { channelId: interaction.channelId },
    });
    if (!tracked) {
      await interaction.reply({
        content: "Run `/track` here first, then everyone `/join`.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }
    // Re-sync so everyone in the channel is tracked (not only /join)
    if (interaction.guildId) {
      await syncChannelMembers(
        interaction.channelId,
        interaction.guildId,
        tracked.name
      );
    }
    // reset lastPingDate so force works per-member via force flag
    await prisma.trackedChannel.update({
      where: { id: tracked.id },
      data: { lastPingDate: null },
    });
    await prisma.trackedMember.updateMany({
      where: { trackedChannelId: tracked.id },
      data: { lastPingDate: null },
    });
    const result = await sendMorningDms(client, prisma, {
      channelDbId: tracked.id,
      force: true,
    });
    await interaction.editReply({
      content: `DMs sent to **${result.sent}** member(s) (skipped ${result.skipped}). They must tap **I'm awake** in Discord DMs.`,
    });
    return;
  }

  if (interaction.commandName === "leaderboard") {
    if (!interaction.channelId) {
      await interaction.reply({
        content: "Use `/leaderboard` in the morning channel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const tracked = await prisma.trackedChannel.findUnique({
      where: { channelId: interaction.channelId },
    });
    if (!tracked) {
      await interaction.reply({
        content: "Run `/track` here first.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const embed = await buildLeaderboardEmbed(prisma, tracked, date, client);
    await interaction.reply({ embeds: [embed] });
    // Also mark as posted if forced
    await prisma.trackedChannel.update({
      where: { id: tracked.id },
      data: { lastLeaderboardDate: date },
    });
    return;
  }

  if (interaction.commandName === "sleep") {
    const name = await resolveDisplayName(client, prisma, user);
    // Log bedtime now
    const existing = await prisma.habitLog.findUnique({
      where: { userId_date: { userId: user.id, date } },
    });
    const checks = mergeLogChecks(existing);
    const bed = nowTime();
    // Mark sleep early if bedtime is at/before sleep goal (evening goals)
    checks.sleepEarly = timeToMin(bed) <= timeToMin(user.sleepGoal);
    await prisma.habitLog.upsert({
      where: { userId_date: { userId: user.id, date } },
      create: {
        userId: user.id,
        date,
        bedtime: bed,
        checks: JSON.stringify(checks),
        ...legacyFrom(checks),
      },
      update: {
        bedtime: bed,
        checks: JSON.stringify(checks),
        ...legacyFrom(checks),
      },
    });

    await interaction.reply({
      content: `Good night **${name}**. I DMed you — plan tomorrow's wake, goal, reminder & todos.`,
      flags: MessageFlags.Ephemeral,
    });
    await sendWindDownDms(client, prisma, { forceUserId: user.id, force: true });
    return;
  }

  if (interaction.commandName === "plan") {
    const summary = await getTomorrowSummary(prisma, interaction.user.id);
    const name = await resolveDisplayName(client, prisma, user);
    if (!summary) {
      await interaction.reply({
        content: "No plan yet — use `/sleep` tonight.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const todos = summary.todos
      .map((t) => `${t.done ? "✅" : "⬜"} ${t.text}`)
      .join("\n");
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x3d5a80)
          .setTitle(`${name} · plan for ${summary.date}`)
          .setDescription(
            [
              `Wake: **${summary.plan?.wakeGoal || user.wakeGoal}**`,
              `Goal: ${summary.plan?.goalText || "_not set_"}`,
              "",
              "**Todos**",
              todos || "_none — /sleep to add_",
            ].join("\n")
          ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.commandName === "week") {
    const since = addDays(date, -6);
    const logs = await prisma.habitLog.findMany({
      where: { userId: user.id, date: { gte: since } },
      orderBy: { date: "asc" },
    });
    const byDate = new Map(logs.map((l) => [l.date, l]));
    const lines: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(date, -i);
      const log = byDate.get(d);
      const checks = mergeLogChecks(log || null);
      const done = habitKeys.filter((k) => checks[k]).length;
      const max = Math.max(habitKeys.length, 1);
      const wake = log?.wakeTime || "--:--";
      const early = checks.wakeEarly ? "🌅" : log?.wakeTime ? "⏰" : "·";
      lines.push(
        `\`${d.slice(5)}\` ${early} ${wake} ${bar(done, max)} ${done}/${max}`
      );
    }
    const earlyCount = logs.filter((l) => mergeLogChecks(l).wakeEarly).length;
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf0b45a)
          .setTitle(`${interaction.user.displayName} · 7-day graph`)
          .setDescription(
            ["```", ...lines, "```", `Early wakes: **${earlyCount}/7**`].join("\n")
          ),
      ],
      ephemeral: true,
    });
    return;
  }

  if (interaction.commandName === "grid") {
    const days = 28;
    const since = addDays(date, -(days - 1));
    const logs = await prisma.habitLog.findMany({
      where: { userId: user.id, date: { gte: since } },
    });
    const byDate = new Map(logs.map((l) => [l.date, l]));
    const max = Math.max(habitKeys.length, 1);
    const cells: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = addDays(date, -i);
      const log = byDate.get(d);
      const checks = mergeLogChecks(log || null);
      const score = habitKeys.filter((k) => checks[k]).length;
      cells.push(log ? gridCell(score, max) : "⬛");
    }
    // 4 rows of 7
    const rows: string[] = [];
    for (let r = 0; r < 4; r++) {
      rows.push(cells.slice(r * 7, r * 7 + 7).join(""));
    }
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf0b45a)
          .setTitle(`${interaction.user.displayName} · 4-week grid`)
          .setDescription(
            [
              rows.join("\n"),
              "",
              "⬛ none · 🟩 some · 🟢 good · 💛 strong",
              `_Same idea as the web contribution grid_`,
            ].join("\n")
          ),
      ],
      ephemeral: true,
    });
    return;
  }

  if (interaction.commandName === "woke") {
    const time = interaction.options.getString("time") || nowTime();
    const existing = await prisma.habitLog.findUnique({
      where: { userId_date: { userId: user.id, date } },
    });
    const checks = mergeLogChecks(existing);
    const firstWake = !existing?.wakeTime;
    const wakeEarly = isBeforeOrAt(time, user.wakeGoal);
    const wakeEarlyNew = wakeEarly && !checks.wakeEarly;
    checks.wakeEarly = wakeEarly;

    await prisma.habitLog.upsert({
      where: { userId_date: { userId: user.id, date } },
      create: {
        userId: user.id,
        date,
        wakeTime: time,
        checks: JSON.stringify(checks),
        ...legacyFrom(checks),
      },
      update: {
        wakeTime: time,
        checks: JSON.stringify(checks),
        ...legacyFrom(checks),
      },
    });

    let xpGain = 0;
    const labels: string[] = [];
    if (firstWake) {
      xpGain += 15;
      labels.push("+15 wake");
    }
    const streak = await earlyStreak(user.id);
    if (wakeEarlyNew || (firstWake && wakeEarly)) {
      const bonus = Math.min(streak, 10) * 8;
      xpGain += 50 + bonus;
      labels.push("+50 early");
      if (bonus) labels.push(`+${bonus} streak`);
    }

    let level = user.level;
    if (xpGain > 0) {
      const xp = user.xp + xpGain;
      const lvl = levelFromXp(xp);
      level = lvl.level;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          xp,
          level,
          totalEarlyWakes:
            user.totalEarlyWakes +
            (wakeEarlyNew || (firstWake && wakeEarly) ? 1 : 0),
          bestWakeStreak: Math.max(user.bestWakeStreak, streak),
        },
      });
    }

    if (interaction.guildId && interaction.channelId) {
      await enrollInChannel(
        user.id,
        interaction.channelId,
        interaction.guildId
      );
    }

    const embed = new EmbedBuilder()
      .setColor(wakeEarly ? 0xf0b45a : 0x3d5a80)
      .setTitle(
        wakeEarly
          ? `${interaction.user.displayName} woke early`
          : `${interaction.user.displayName} woke up`
      )
      .setDescription(
        [
          `Wake **${time}** · goal **${user.wakeGoal}**`,
          xpGain ? `**+${xpGain} XP** (${labels.join(", ")})` : null,
          `Level **${level}** · early streak **${streak}**`,
        ]
          .filter(Boolean)
          .join("\n")
      );

    await interaction.reply({ embeds: [embed] });

    // Refresh morning board in tracked channel
    if (interaction.channelId) {
      const tracked = await prisma.trackedChannel.findUnique({
        where: { channelId: interaction.channelId },
      });
      if (tracked && interaction.channel && interaction.channel.isTextBased()) {
        const board = await buildMorningBoard(tracked.id, date);
        if (board) {
          await interaction.followUp({ embeds: [board] });
        }
      }
    }
    return;
  }

  if (interaction.commandName === "checkin") {
    const log = await prisma.habitLog.findUnique({
      where: { userId_date: { userId: user.id, date } },
    });
    const checks = mergeLogChecks(log);
    const rows = habitButtonRows(habits, checks);
    if (!rows.length) {
      await interaction.reply({
        content: "No habits — `/habit add name:…`",
        ephemeral: true,
      });
      return;
    }
    await interaction.reply({
      content: `Toggle habits · **${date}**`,
      components: rows,
      ephemeral: true,
    });
    return;
  }

  if (interaction.commandName === "habit") {
    const sub = interaction.options.getSubcommand();
    if (sub === "add") {
      const name = interaction.options.getString("name", true).trim().slice(0, 60);
      const description = (interaction.options.getString("description") || "").slice(
        0,
        160
      );
      const key = slugify(name);
      const existing = await prisma.habit.findUnique({
        where: { userId_key: { userId: user.id, key } },
      });
      if (existing) {
        await prisma.habit.update({
          where: { id: existing.id },
          data: { active: true, label: name, description },
        });
        await interaction.reply({
          content: `Re-enabled **${name}**.`,
          ephemeral: true,
        });
        return;
      }
      const maxSort = await prisma.habit.aggregate({
        where: { userId: user.id },
        _max: { sortOrder: true },
      });
      await prisma.habit.create({
        data: {
          userId: user.id,
          key,
          label: name,
          description,
          sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
          active: true,
        },
      });
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf0b45a)
            .setTitle("Habit added")
            .setDescription(`**${name}** — use \`/checkin\` or \`/habit done\``),
        ],
      });
      return;
    }
    if (sub === "list") {
      const list = await ensureHabits(user.id);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf0b45a)
            .setTitle("Your habits")
            .setDescription(
              list
                .map(
                  (h) =>
                    `• **${h.label}**${h.key === user.focusHabitKey ? " ★" : ""}`
                )
                .join("\n") || "None"
            ),
        ],
        ephemeral: true,
      });
      return;
    }
    if (sub === "remove") {
      const name = interaction.options.getString("name", true).trim();
      const found = habits.find(
        (h) =>
          h.key.toLowerCase() === name.toLowerCase() ||
          h.label.toLowerCase() === name.toLowerCase()
      );
      if (!found) {
        await interaction.reply({ content: "Habit not found.", ephemeral: true });
        return;
      }
      if (found.isDefault) {
        await prisma.habit.update({
          where: { id: found.id },
          data: { active: false },
        });
      } else {
        await prisma.habit.delete({ where: { id: found.id } });
      }
      await interaction.reply({
        content: `Removed **${found.label}**.`,
        ephemeral: true,
      });
      return;
    }
    if (sub === "done") {
      const name = interaction.options.getString("name", true).trim();
      const found = habits.find(
        (h) =>
          h.key.toLowerCase() === name.toLowerCase() ||
          h.label.toLowerCase() === name.toLowerCase()
      );
      if (!found) {
        await interaction.reply({ content: "Habit not found.", ephemeral: true });
        return;
      }
      const existing = await prisma.habitLog.findUnique({
        where: { userId_date: { userId: user.id, date } },
      });
      const checks = mergeLogChecks(existing);
      const was = Boolean(checks[found.key]);
      checks[found.key] = true;
      await prisma.habitLog.upsert({
        where: { userId_date: { userId: user.id, date } },
        create: {
          userId: user.id,
          date,
          checks: JSON.stringify(checks),
          ...legacyFrom(checks),
        },
        update: {
          checks: JSON.stringify(checks),
          ...legacyFrom(checks),
        },
      });
      let xpNote = "";
      if (!was && found.key === user.focusHabitKey) {
        const xp = user.xp + 35;
        await prisma.user.update({
          where: { id: user.id },
          data: { xp, level: levelFromXp(xp).level },
        });
        xpNote = " · +35 XP focus";
      }
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x6fbf8a)
            .setTitle(`${found.label} done`)
            .setDescription(`${date}${xpNote}`),
        ],
      });
      return;
    }
  }

  if (interaction.commandName === "review") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
    const result = await sendNightReviewDms(client, prisma, {
      forceUserId: user.id,
      force: true,
    });
    await interaction.editReply({
      content:
        result.sent > 0
          ? "Night review DM sent — check your DMs."
          : "Could not DM you — open DMs from server members.",
    });
    return;
  }

  if (interaction.commandName === "report") {
    if (!interaction.channelId) {
      await interaction.reply({
        content: "Use `/report` in the morning channel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const tracked = await prisma.trackedChannel.findUnique({
      where: { channelId: interaction.channelId },
    });
    if (!tracked) {
      await interaction.reply({
        content: "Run `/track` here first.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }
    const report = await buildConsistencyReport(prisma, tracked, client, {
      date,
    });
    await interaction.editReply({
      content: report.content,
      embeds: report.embeds,
      allowedMentions: { users: report.pingIds },
    });
    await prisma.trackedChannel.update({
      where: { id: tracked.id },
      data: { lastReportDate: date },
    });
    return;
  }

  if (interaction.commandName === "todo") {
    const sub = interaction.options.getSubcommand();
    const name = await resolveDisplayName(client, prisma, user);

    if (sub === "list") {
      const todos = await listTodosForDate(prisma, user.id, date);
      const goalText = await getDayPlanGoal(prisma, user.id, date);
      await interaction.reply({
        embeds: [buildTodoEmbed({ name, date, todos, goalText })],
        components: todoToggleRows(todos),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "add") {
      const text = interaction.options.getString("text", true);
      const result = await addTodosForDate(prisma, {
        userId: user.id,
        date,
        raw: text,
      });
      const todos = result.created;
      const goalText = await getDayPlanGoal(prisma, user.id, date);
      await interaction.reply({
        content: `Added **${result.items.length}** todo(s) for today.`,
        embeds: [buildTodoEmbed({ name, date, todos, goalText })],
        components: todoToggleRows(todos),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "done") {
      const n = interaction.options.getInteger("number", true);
      const marked = await markTodoByIndex(prisma, {
        userId: user.id,
        index: n,
        date,
      });
      if (!marked) {
        await interaction.reply({
          content: `No todo #${n} — run \`/todo list\` first.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const goalText = await getDayPlanGoal(prisma, user.id, date);
      await interaction.reply({
        content: `${marked.todo.done ? "Done" : "Reopened"}: **${marked.todo.text}**`,
        embeds: [
          buildTodoEmbed({ name, date, todos: marked.todos, goalText }),
        ],
        components: todoToggleRows(marked.todos),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "tomorrow") {
      const summary = await getTomorrowSummary(prisma, interaction.user.id);
      if (!summary) {
        await interaction.reply({
          content: "No plan yet — use `/sleep` tonight.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply({
        embeds: [
          buildTodoEmbed({
            name,
            date: summary.date,
            todos: summary.todos,
            goalText: summary.plan?.goalText,
          }),
        ],
        components: todoToggleRows(summary.todos),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    return;
  }

  if (interaction.commandName === "today") {
    const log = await prisma.habitLog.findUnique({
      where: { userId_date: { userId: user.id, date } },
    });
    const checks = mergeLogChecks(log);
    const done = habitKeys.filter((k) => checks[k]).length;
    const lines = habits.map(
      (h) =>
        `${checks[h.key] ? "✅" : "⬜"} ${h.label}${h.key === user.focusHabitKey ? " ★" : ""}`
    );
    const todos = await listTodosForDate(prisma, user.id, date);
    const goalText = await getDayPlanGoal(prisma, user.id, date);
    const cons = await consistencySummary(prisma, user.id);
    const todoLines = todos.length
      ? todos
          .map((t) => `${t.done ? "✅" : "⬜"} ${t.text}`)
          .join("\n")
      : "_none — `/todo add` or set with `/sleep`_";
    const lvl = levelFromXp(user.xp);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf0b45a)
          .setTitle(`${interaction.user.displayName} · today`)
          .setDescription(
            [
              `Wake **${log?.wakeTime || "—"}** · bed **${log?.bedtime || "—"}**`,
              `${done}/${habits.length} habits · Lv ${lvl.level} · ${user.xp} XP`,
              cons
                ? `Consistency **${cons.streak}** day(s)` +
                  (cons.yesterday ? ` · yesterday ${cons.yesterday}` : "")
                : null,
              goalText ? `Goal: **${goalText}**` : null,
              "",
              "**Habits**",
              lines.join("\n"),
              "",
              "**Todos**",
              todoLines,
              "",
              "Manage todos: `/todo list`",
            ]
              .filter(Boolean)
              .join("\n")
          ),
      ],
      components: todos.length ? todoToggleRows(todos).slice(0, 5) : [],
    });
    return;
  }

  if (interaction.commandName === "me" || interaction.commandName === "why") {
    const lvl = levelFromXp(user.xp);
    const focus =
      habits.find((h) => h.key === user.focusHabitKey)?.label || user.focusHabitKey;
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf0b45a)
          .setTitle(
            user.identityLine
              ? `I am someone who ${user.identityLine}`
              : interaction.user.displayName
          )
          .setDescription(
            [
              user.whyLine || "_No why — /setup_",
              `Focus **${focus}** · wake **${user.wakeGoal}** · sleep **${user.sleepGoal}**`,
              `Lv **${lvl.level}** · ${user.xp} XP · ${user.totalEarlyWakes} early wakes`,
            ].join("\n")
          ),
      ],
      ephemeral: interaction.commandName === "why",
    });
    return;
  }

  if (interaction.commandName === "streak") {
    const e = await earlyStreak(user.id);
    const p = await perfectStreak(user.id, habitKeys);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x6fbf8a)
          .setTitle("Streaks")
          .setDescription(`🔥 Early **${e}** · ✨ Perfect **${p}**`),
      ],
    });
    return;
  }

  if (interaction.commandName === "focus") {
    const name = interaction.options.getString("name", true).trim();
    let found = habits.find(
      (h) =>
        h.key.toLowerCase() === name.toLowerCase() ||
        h.label.toLowerCase() === name.toLowerCase()
    );
    if (!found) {
      const key = slugify(name);
      const maxSort = await prisma.habit.aggregate({
        where: { userId: user.id },
        _max: { sortOrder: true },
      });
      found = await prisma.habit.create({
        data: {
          userId: user.id,
          key,
          label: name.slice(0, 60),
          description: "14-day focus",
          sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
          active: true,
        },
      });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { focusHabitKey: found.key },
    });
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf0b45a)
          .setTitle("Focus locked")
          .setDescription(`**${found.label}** — +35 XP when done`),
      ],
    });
    return;
  }

  if (interaction.commandName === "board") {
    const membership = await prisma.circleMember.findFirst({
      where: { userId: user.id },
      include: {
        circle: { include: { members: { include: { user: true } } } },
      },
    });
    if (!membership) {
      await interaction.reply({
        content: "No web circle — use `/morning` in your study channel instead.",
        ephemeral: true,
      });
      return;
    }
    // reuse morning-style lines for circle
    const members = membership.circle.members;
    const nameMap = await resolveManyNames(
      client,
      prisma,
      members.map((m) => m.user)
    );
    const logs = await prisma.habitLog.findMany({
      where: { userId: { in: members.map((m) => m.userId) }, date },
    });
    const logMap = Object.fromEntries(logs.map((l) => [l.userId, l]));
    const lines = members.map((m) => {
      const log = logMap[m.userId];
      const name = nameMap.get(m.user.id) || m.user.name || "Member";
      if (!log?.wakeTime) return `⬜ **${name}** — not up`;
      const early = log.wakeEarly ? "🌅" : "⏰";
      return `${early} **${name}** — ${log.wakeTime}`;
    });
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x3d5a80)
          .setTitle(`${membership.circle.name} · ${date}`)
          .setDescription(lines.join("\n")),
      ],
    });
  }
}

async function handleButton(interaction: ButtonInteraction) {
  const date = todayStr();

  if (isStudyActivityCustomId(interaction.customId)) {
    await handleStudyActivityButton(prisma, interaction);
    return;
  }

  // Public board join / leave (no privileged members intent needed)
  if (interaction.customId === "board:join" || interaction.customId === "board:leave") {
    if (!interaction.guildId || !interaction.channelId) {
      await interaction.reply({
        content: "Use this in the morning channel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const tracked = await prisma.trackedChannel.findUnique({
      where: { channelId: interaction.channelId },
    });
    if (!tracked) {
      await interaction.reply({
        content: "Run `/track` here first.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const user = await findOrCreateUser(
      interaction.user.id,
      interaction.user.displayName || interaction.user.username
    );

    if (interaction.customId === "board:leave") {
      await prisma.trackedMember.deleteMany({
        where: { trackedChannelId: tracked.id, userId: user.id },
      });
      await interaction.reply({
        content: "You left the Dawn board — no more morning DMs.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await enrollInChannel(
      user.id,
      interaction.channelId,
      interaction.guildId
    );
    const total = await prisma.trackedMember.count({
      where: { trackedChannelId: tracked.id },
    });
    await interaction.reply({
      content: `You're on the board, **${interaction.user.displayName}**. Morning DMs will reach you. (${total} tracked)`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Wind-down / before sleep
  if (interaction.customId.startsWith("wd:")) {
    const part = interaction.customId.slice(3);

    if (part === "skip") {
      await interaction.update({
        content: "Skipped — rest well.",
        embeds: [],
        components: [],
      });
      return;
    }

    if (part === "start") {
      await interaction.update({
        content: "**What time will you wake up tomorrow?**",
        embeds: [],
        components: tomorrowWakeRows(),
      });
      return;
    }

    if (part.startsWith("wake:")) {
      const wakeTime = part.slice(5);
      const saved = await saveTomorrowWake(
        prisma,
        interaction.user.id,
        wakeTime
      );
      if (!saved) {
        await interaction.reply({
          content: "Could not save — `/join` a board first or use Discord login.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.update({
        content: `Tomorrow wake set to **${wakeTime}**. Now set goal, todos, reminder:`,
        components: afterWakeChoiceRows(),
      });
      return;
    }

    if (part === "goal") {
      await interaction.showModal(goalModal());
      return;
    }
    if (part === "todos") {
      await interaction.showModal(todosModal());
      return;
    }
    if (part === "remind") {
      const rem = await setWakeReminder(prisma, interaction.user.id);
      if (!rem) {
        await interaction.reply({
          content: "Set a wake time first.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply({
        content: `Wake reminder set for **${rem.time}** (Discord DM + browser if enabled).`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (part === "done") {
      const summary = await getTomorrowSummary(prisma, interaction.user.id);
      const todos =
        summary?.todos.map((t) => `• ${t.text}`).join("\n") || "_none_";
      await interaction.update({
        content: "",
        embeds: [
          new EmbedBuilder()
            .setColor(0x3d5a80)
            .setTitle("Good night — plan locked")
            .setDescription(
              [
                `Wake **${summary?.plan?.wakeGoal || "—"}**`,
                `Goal: ${summary?.plan?.goalText || "_not set_"}`,
                "",
                "**Todos**",
                todos,
                "",
                "See you at dawn. `/plan` anytime.",
              ].join("\n")
            ),
        ],
        components: [],
      });
      return;
    }
    return;
  }

  // Morning DM: I'm awake / Snoozing
  if (
    interaction.customId.startsWith("wakeack:") ||
    interaction.customId.startsWith("wakesnooze:")
  ) {
    // Acknowledge fast — avoids Unknown interaction (3s limit / dual bots)
    try {
      await interaction.deferUpdate();
    } catch {
      /* already acknowledged or expired */
    }

    const snooze = interaction.customId.startsWith("wakesnooze:");
    const trackedId = interaction.customId.split(":")[1];
    const result = await recordWakeFromDm(prisma, {
      discordUserId: interaction.user.id,
      trackedChannelId: trackedId,
      snooze,
    });
    if (!result.ok) {
      await respond(interaction, { content: result.error });
      return;
    }
    if (result.snooze) {
      await respond(interaction, {
        content:
          "Marked as snoozing — you won't count as awake until you tap **I'm awake**.",
        embeds: [],
        components: [],
      });
      return;
    }

    const cons = await consistencySummary(prisma, result.user.id);
    const consLine = cons
      ? `Consistency **${cons.streak}** day(s)` +
        (cons.yesterday ? ` · yesterday todos ${cons.yesterday}` : "")
      : null;

    await respond(interaction, {
      content: "",
      embeds: [
        new EmbedBuilder()
          .setColor(result.wakeEarly ? 0xf0b45a : 0x3d5a80)
          .setTitle(result.wakeEarly ? "🌅 Early wake — nice" : "☀️ You’re awake")
          .setDescription(
            [
              `Logged **${result.wakeTime}** · **+${result.xpGain} XP**`,
              consLine ? `🔥 ${consLine}` : null,
              "",
              "**Step 1 of 3 — Reminder**",
              "Want a custom reminder? You’ll type **what** and **what time**.",
            ]
              .filter(Boolean)
              .join("\n")
          ),
      ],
      components: morningRemindAskRows(),
    });

    // Channel board refresh (non-blocking)
    void (async () => {
      try {
        const ch = await client.channels.fetch(result.channel.channelId);
        if (ch && ch.isTextBased() && "send" in ch) {
          const embed = await buildLeaderboardEmbed(
            prisma,
            result.channel,
            undefined,
            client
          );
          await ch.send({
            content: `🌅 **${interaction.user.displayName}** checked in`,
            embeds: [embed],
          });
        }
      } catch (e) {
        console.error("Could not update channel board", e);
      }
    })();
    return;
  }

  // Morning Q series: reminder → time → todos
  if (interaction.customId.startsWith("mq:")) {
    const part = interaction.customId.slice(3);

    if (part === "remind:yes") {
      await interaction.showModal(morningRemindModal());
      return;
    }
    if (part === "remind:no") {
      await respond(interaction, {
        content:
          "**Step 3 — Todos for today**\nAdd what you’ll finish, or skip if you set them last night.",
        embeds: [],
        components: morningTodoAskRows(),
      });
      return;
    }
    // legacy fixed-time buttons (ignore → send to todos)
    if (part.startsWith("time:")) {
      await respond(interaction, {
        content:
          "Please use **Yes — set a reminder** and type what + time.\n\n**Step 3 — Todos for today**",
        embeds: [],
        components: morningTodoAskRows(),
      });
      return;
    }
    if (part === "todos") {
      await interaction.showModal(morningTodosModal());
      return;
    }
    if (part === "skip_todos" || part === "finish") {
      const user = await findOrCreateUser(
        interaction.user.id,
        interaction.user.displayName || interaction.user.username
      );
      const habits = await listHabits(user.id);
      const existing = await prisma.habitLog.findUnique({
        where: { userId_date: { userId: user.id, date } },
      });
      const checks = mergeLogChecks(existing);
      const todos = await listTodosForDate(prisma, user.id, date);
      const goalText = await getDayPlanGoal(prisma, user.id, date);
      const name = await resolveDisplayName(client, prisma, user);
      const rows = [
        ...(habits.length ? habitDmRows(habits, checks).slice(0, 3) : []),
        ...todoToggleRows(todos).slice(0, habits.length ? 2 : 4),
      ].slice(0, 5);
      await respond(interaction, {
        content: "",
        embeds: [
          new EmbedBuilder()
            .setColor(0xf0b45a)
            .setTitle("Morning locked in ✓")
            .setDescription(
              [
                goalText ? `📌 Goal: **${goalText}**` : null,
                "",
                habits.length
                  ? "**Your habits** (tap to toggle)"
                  : "_No habits yet — optional: `/habit add`_",
                "**Your todos** (tap through the day)",
                "",
                formatTodoLines(todos),
                "",
                "Tonight Dawn will ask which tasks you finished → that fills the consistency graph.",
              ]
                .filter(Boolean)
                .join("\n")
            ),
        ],
        components: rows.length ? rows : morningTodoAskRows(),
      });
      // also send a dedicated todo card if many
      if (todos.length) {
        try {
          await interaction.user.send({
            embeds: [buildTodoEmbed({ name, date, todos, goalText })],
            components: todoToggleRows(todos),
          });
        } catch {
          /* ignore */
        }
      }
      return;
    }
    return;
  }

  // Nightly task review
  if (interaction.customId.startsWith("nr:")) {
    const part = interaction.customId.slice(3);
    const user = await findOrCreateUser(
      interaction.user.id,
      interaction.user.displayName || interaction.user.username
    );
    const today = todayStr();

    if (part === "skip") {
      await respond(interaction, {
        content: "Skipped — rest well. Consistency not updated.",
        embeds: [],
        components: [],
      });
      return;
    }
    if (part === "none") {
      const todos = await listTodosForDate(prisma, user.id, today);
      for (const t of todos) {
        if (t.done) {
          await prisma.todo.update({ where: { id: t.id }, data: { done: false } });
        }
      }
      const finished = await finishNightReview(prisma, user, today);
      await respond(interaction, {
        content: "",
        embeds: [
          new EmbedBuilder()
            .setColor(0x3d5a80)
            .setTitle("Progress saved")
            .setDescription(
              `**0/${finished.todosTotal}** todos · consistency streak **${finished.streak}**`
            ),
        ],
        components: [],
      });
      return;
    }
    if (part === "yes") {
      const todos = await listTodosForDate(prisma, user.id, today);
      if (!todos.length) {
        await respond(interaction, {
          content: "No todos today — nothing to mark. Use `/todo add` tomorrow morning.",
          embeds: [],
          components: [],
        });
        await finishNightReview(prisma, user, today);
        return;
      }
      await respond(interaction, {
        content: "**Which ones did you complete?** Tap to toggle, then **Save progress**.",
        embeds: [],
        components: nightReviewTodoRows(todos),
      });
      return;
    }
    if (part.startsWith("toggle:")) {
      const todoId = part.slice(7);
      await toggleTodo(prisma, {
        todoId,
        discordUserId: interaction.user.id,
      });
      const todos = await listTodosForDate(prisma, user.id, today);
      await respond(interaction, {
        content: "**Which ones did you complete?** Tap to toggle, then **Save progress**.",
        embeds: [],
        components: nightReviewTodoRows(todos),
      });
      return;
    }
    if (part === "all") {
      await prisma.todo.updateMany({
        where: { userId: user.id, date: today },
        data: { done: true },
      });
      const todos = await listTodosForDate(prisma, user.id, today);
      await respond(interaction, {
        content: "All marked done — tap **Save progress**.",
        embeds: [],
        components: nightReviewTodoRows(todos),
      });
      return;
    }
    if (part === "finish") {
      const finished = await finishNightReview(prisma, user, today);
      await respond(interaction, {
        content: "",
        embeds: [
          new EmbedBuilder()
            .setColor(0x6fbf8a)
            .setTitle("Day locked")
            .setDescription(
              [
                `Todos **${finished.todosDone}/${finished.todosTotal}** saved to your progress.`,
                `Consistency streak **${finished.streak}** (best ${finished.best}).`,
                "See you at dawn.",
              ].join("\n")
            ),
        ],
        components: [],
      });
      return;
    }
    return;
  }

  // Daily todo toggles / add (kept in Discord)
  if (interaction.customId.startsWith("td:")) {
    const part = interaction.customId.slice(3);
    if (part === "add") {
      await interaction.showModal(todayTodoModal());
      return;
    }
    if (part.startsWith("toggle:")) {
      const todoId = part.slice(7);
      const toggled = await toggleTodo(prisma, {
        todoId,
        discordUserId: interaction.user.id,
      });
      if (!toggled) {
        await interaction.reply({
          content: "Could not update that todo.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await syncDayProgress(prisma, toggled.user.id, toggled.date);
      const name = await resolveDisplayName(client, prisma, toggled.user);
      const goalText = await getDayPlanGoal(
        prisma,
        toggled.user.id,
        toggled.date
      );
      await interaction.update({
        embeds: [
          buildTodoEmbed({
            name,
            date: toggled.date,
            todos: toggled.todos,
            goalText,
          }),
        ],
        components: todoToggleRows(toggled.todos),
      });
      return;
    }
    return;
  }

  // Habit toggles from DM after wake
  if (interaction.customId.startsWith("dmh:")) {
    const key = interaction.customId.slice(4);
    const toggled = await toggleHabitFromDm(prisma, {
      discordUserId: interaction.user.id,
      habitKey: key,
    });
    if (!toggled) {
      await interaction.reply({
        content: "Could not update habit.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const label =
      toggled.habits.find((h) => h.key === key)?.label || key;
    await interaction.update({
      content: `**${label}** → ${toggled.checks[key] ? "done" : "not yet"}`,
      components: habitDmRows(toggled.habits, toggled.checks),
    });
    return;
  }

  // Setup buttons
  if (interaction.customId.startsWith("su:")) {
    const parts = interaction.customId.split(":");
    const kind = parts[1];
    const val = parts.slice(2).join(":");
    const state = setups.get(interaction.user.id) || { step: "why" as const };

    if (kind === "why") {
      if (val === "other") {
        const modal = new ModalBuilder()
          .setCustomId("su_modal_why")
          .setTitle("Your why")
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId("text")
                .setLabel("Why wake early?")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(200)
            )
          );
        await interaction.showModal(modal);
        return;
      }
      const opt = WHY_OPTS.find((o) => o.id === val);
      state.why = opt?.value || val;
      state.step = "wake";
      setups.set(interaction.user.id, state);
      await showSetupStep(interaction, "wake");
      return;
    }

    if (kind === "wake") {
      state.wakeGoal = val;
      state.step = "sleep";
      setups.set(interaction.user.id, state);
      await showSetupStep(interaction, "sleep");
      return;
    }

    if (kind === "sleep") {
      state.sleepGoal = val;
      state.step = "friction";
      setups.set(interaction.user.id, state);
      await showSetupStep(interaction, "friction");
      return;
    }

    if (kind === "fric") {
      const opt = FRICTION_OPTS.find((o) => o.id === val);
      state.friction = opt?.value || val;
      state.step = "focus";
      setups.set(interaction.user.id, state);
      await showSetupStep(interaction, "focus");
      return;
    }

    if (kind === "focus") {
      if (val === "custom") {
        const modal = new ModalBuilder()
          .setCustomId("su_modal_focus")
          .setTitle("Custom focus habit")
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId("text")
                .setLabel("Habit name")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(60)
            )
          );
        await interaction.showModal(modal);
        return;
      }
      const opt = FOCUS_OPTS.find((o) => o.id === val);
      state.focusKey = val;
      state.focusLabel = opt?.label || val;
      state.step = "identity";
      setups.set(interaction.user.id, state);
      await showSetupStep(interaction, "identity");
      return;
    }

    if (kind === "id" && val === "write") {
      const modal = new ModalBuilder()
        .setCustomId("su_modal_id")
        .setTitle("I am someone who…")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("text")
              .setLabel("Finish the sentence")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMaxLength(120)
              .setPlaceholder("wakes early and owns the first hour")
          )
        );
      await interaction.showModal(modal);
      return;
    }
    return;
  }

  // Habit toggle
  if (!interaction.customId.startsWith("h:")) return;
  const key = interaction.customId.slice(2);
  const user = await findOrCreateUser(
    interaction.user.id,
    interaction.user.displayName || interaction.user.username
  );
  const habits = await ensureHabits(user.id);
  if (!habits.some((h) => h.key === key)) {
    await interaction.reply({ content: "Habit not on your list.", ephemeral: true });
    return;
  }
  const existing = await prisma.habitLog.findUnique({
    where: { userId_date: { userId: user.id, date } },
  });
  const checks = mergeLogChecks(existing);
  checks[key] = !checks[key];
  await prisma.habitLog.upsert({
    where: { userId_date: { userId: user.id, date } },
    create: {
      userId: user.id,
      date,
      checks: JSON.stringify(checks),
      ...legacyFrom(checks),
    },
    update: {
      checks: JSON.stringify(checks),
      ...legacyFrom(checks),
    },
  });
  if (checks[key] && key === user.focusHabitKey) {
    const xp = user.xp + 35;
    await prisma.user.update({
      where: { id: user.id },
      data: { xp, level: levelFromXp(xp).level },
    });
  }
  const label = habits.find((h) => h.key === key)?.label || key;
  await interaction.update({
    content: `**${label}** → ${checks[key] ? "done" : "not yet"}`,
    components: habitButtonRows(habits, checks),
  });
}

async function handleModal(interaction: ModalSubmitInteraction) {
  if (isStudyActivityCustomId(interaction.customId)) {
    await handleStudyActivityModal(prisma, interaction);
    return;
  }
  if (interaction.customId === "mq_modal_remind") {
    const what = interaction.fields.getTextInputValue("what").trim();
    const timeRaw = interaction.fields.getTextInputValue("time").trim();
    const time = normalizeHHMM(timeRaw);
    if (!time) {
      await interaction.reply({
        content:
          `Time **${timeRaw}** isn’t valid. Use 24h like \`14:30\` or \`09:00\`.\nTap **Yes — set a reminder** again.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const saved = await saveMorningReminder(
      prisma,
      interaction.user.id,
      time,
      what
    );
    await interaction.reply({
      content: saved
        ? [
            `Reminder set ✓`,
            `**What:** ${saved.message}`,
            `**When:** **${saved.time}** (Discord DM)`,
            "",
            "**Step 3 — Todos for today**",
            "Add what you’ll finish, or skip if you already set them.",
          ].join("\n")
        : "Could not save reminder — try `/join` first.",
      components: saved ? morningTodoAskRows() : [],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const text = interaction.fields.getTextInputValue("text").trim();

  if (interaction.customId === "wd_modal_goal") {
    const saved = await saveTomorrowGoal(prisma, interaction.user.id, text);
    await interaction.reply({
      content: saved
        ? `Tomorrow's goal saved: **${text}**\nKeep going — add todos or set reminder.`
        : "Could not save goal.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.customId === "wd_modal_todos") {
    const saved = await saveTodos(prisma, interaction.user.id, text);
    await interaction.reply({
      content: saved
        ? `Added **${saved.items.length}** todo(s) for ${saved.date}:\n${saved.items.map((t) => `• ${t}`).join("\n")}`
        : "Could not save todos.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.customId === "td_modal_add") {
    const user = await findOrCreateUser(
      interaction.user.id,
      interaction.user.displayName || interaction.user.username
    );
    const date = todayStr();
    const result = await addTodosForDate(prisma, {
      userId: user.id,
      date,
      raw: text,
    });
    await syncDayProgress(prisma, user.id, date);
    const name = await resolveDisplayName(client, prisma, user);
    const goalText = await getDayPlanGoal(prisma, user.id, date);
    await interaction.reply({
      content: `Added **${result.items.length}** todo(s) for today.`,
      embeds: [
        buildTodoEmbed({
          name,
          date,
          todos: result.created,
          goalText,
        }),
      ],
      components: todoToggleRows(result.created),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.customId === "mq_modal_todos") {
    const user = await findOrCreateUser(
      interaction.user.id,
      interaction.user.displayName || interaction.user.username
    );
    const date = todayStr();
    const result = await addTodosForDate(prisma, {
      userId: user.id,
      date,
      raw: text,
    });
    await syncDayProgress(prisma, user.id, date);
    const habits = await listHabits(user.id);
    const existing = await prisma.habitLog.findUnique({
      where: { userId_date: { userId: user.id, date } },
    });
    const checks = mergeLogChecks(existing);
    const name = await resolveDisplayName(client, prisma, user);
    const goalText = await getDayPlanGoal(prisma, user.id, date);
    await interaction.reply({
      content: `Added **${result.items.length}** todo(s). Morning locked in.`,
      embeds: [
        buildTodoEmbed({
          name,
          date,
          todos: result.created,
          goalText,
        }),
      ],
      components: [
        ...(habits.length ? habitDmRows(habits, checks).slice(0, 2) : []),
        ...todoToggleRows(result.created).slice(0, habits.length ? 3 : 5),
      ].slice(0, 5),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const state = setups.get(interaction.user.id) || { step: "why" as const };

  if (interaction.customId === "su_modal_why") {
    state.why = text;
    state.step = "wake";
    setups.set(interaction.user.id, state);
    await showSetupStep(interaction, "wake");
    return;
  }
  if (interaction.customId === "su_modal_focus") {
    state.focusLabel = text;
    state.focusKey = slugify(text);
    state.step = "identity";
    setups.set(interaction.user.id, state);
    await showSetupStep(interaction, "identity");
    return;
  }
  if (interaction.customId === "su_modal_id") {
    state.identity = text;
    setups.set(interaction.user.id, state);
    await completeSetup(interaction, state);
  }
}

attachStudyVoice(client, prisma);

function startHealthServer() {
  const port = Number(process.env.PORT || 8080);
  if (!Number.isFinite(port) || port <= 0) return;
  const server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(client.isReady() ? "dawn-bot ok" : "dawn-bot starting");
  });
  server.listen(port, "0.0.0.0", () => {
    console.log(`Health server on :${port}`);
  });
}

startHealthServer();

registerCommands()
  .then(() => client.login(token))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
