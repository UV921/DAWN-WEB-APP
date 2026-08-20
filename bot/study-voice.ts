/**
 * Track time in marked study voice channels.
 * Counts only existing Dawn users (discordId linked). Bot must stay online.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
  type VoiceState,
} from "discord.js";
import type { PrismaClient, StudySession } from "@prisma/client";
import { DEFAULT_TZ } from "../src/lib/clock";
import {
  envStudyVoiceIds,
  formatStudyDuration,
  lastNDates,
  MAX_SESSION_MS,
  MIN_SESSION_MS,
  minutesOnLocalDate,
  sessionMinutes,
  todayInZone,
} from "../src/lib/study-time";
import {
  isWebStudySession,
  normalizeStudyActivity,
  STUDY_ACTIVITY_MAX,
  STUDY_ACTIVITY_PRESETS,
  studyActivityLabel,
} from "../src/lib/study-activity";
import {
  collectChannelIds,
  parseBotMessages,
} from "../src/lib/bot-messages";
import { safeRespond } from "./respond";

type RoomCache = { ids: Set<string>; at: number };
let roomCache: RoomCache | null = null;
const ROOM_TTL_MS = 20_000;

export function invalidateStudyRoomCache() {
  roomCache = null;
}

async function loadStudyRoomIds(prisma: PrismaClient): Promise<Set<string>> {
  if (roomCache && Date.now() - roomCache.at < ROOM_TTL_MS) {
    return roomCache.ids;
  }
  const rows = await prisma.studyRoom.findMany({ select: { channelId: true } });
  const ids = new Set<string>([
    ...envStudyVoiceIds(),
    ...rows.map((r) => r.channelId),
  ]);
  roomCache = { ids, at: Date.now() };
  return ids;
}

async function isStudyRoom(
  prisma: PrismaClient,
  channelId: string | null
): Promise<boolean> {
  if (!channelId) return false;
  const ids = await loadStudyRoomIds(prisma);
  return ids.has(channelId);
}

async function findDawnUser(prisma: PrismaClient, discordId: string) {
  return prisma.user.findFirst({
    where: {
      OR: [
        { discordId },
        {
          accounts: {
            some: { provider: "discord", providerAccountId: discordId },
          },
        },
      ],
    },
    select: {
      id: true,
      timezone: true,
      discordId: true,
      name: true,
      discordChannelId: true,
      botMessagesJson: true,
    },
  });
}

function discordIdsForUser(user: {
  discordId?: string | null;
  accounts?: { providerAccountId: string }[];
}): string[] {
  const ids: string[] = [];
  if (user.discordId) ids.push(user.discordId);
  for (const a of user.accounts || []) {
    if (a.providerAccountId && !ids.includes(a.providerAccountId)) {
      ids.push(a.providerAccountId);
    }
  }
  return ids;
}

/** Who is sitting in a marked study VC right now. */
async function peopleInStudyRooms(
  client: Client,
  rooms: Set<string>
): Promise<Map<string, { guildId: string; channelId: string }>> {
  const present = new Map<string, { guildId: string; channelId: string }>();
  const note = (discordId: string, guildId: string, channelId: string) => {
    if (!discordId || !rooms.has(channelId)) return;
    present.set(discordId, { guildId, channelId });
  };

  for (const guild of client.guilds.cache.values()) {
    for (const vs of guild.voiceStates.cache.values()) {
      if (vs.member?.user?.bot) continue;
      if (vs.channelId) note(vs.id, guild.id, vs.channelId);
    }
  }

  for (const channelId of rooms) {
    const ch = await client.channels.fetch(channelId).catch(() => null);
    if (!ch || !ch.isVoiceBased() || !ch.guildId) continue;
    for (const member of ch.members.values()) {
      if (member.user.bot) continue;
      note(member.id, ch.guildId, ch.id);
    }
  }
  return present;
}

function activityAskRows(discordId: string, selected?: string | null) {
  const presetBtns = STUDY_ACTIVITY_PRESETS.map((p) =>
    new ButtonBuilder()
      .setCustomId(`st:${p.key}:${discordId}`)
      .setLabel(p.label)
      .setStyle(
        p.key === selected
          ? ButtonStyle.Success
          : p.key === "coding"
            ? ButtonStyle.Primary
            : ButtonStyle.Secondary
      )
  );
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...presetBtns,
      new ButtonBuilder()
        .setCustomId(`st:other:${discordId}`)
        .setLabel("Write it…")
        .setStyle(
          selected === "custom" ? ButtonStyle.Success : ButtonStyle.Secondary
        )
    ),
  ];
}

function activityModal(discordId: string) {
  return new ModalBuilder()
    .setCustomId(`st_modal:${discordId}`)
    .setTitle("What are you doing?")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("text")
          .setLabel("Write it in your words")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(STUDY_ACTIVITY_MAX)
          .setPlaceholder("Coding Dawn, reading notes, …")
      )
    );
}

function activityAskEmbed(name?: string | null) {
  const who = name ? `**${name}**, ` : "";
  return new EmbedBuilder()
    .setColor(0xf0b45a)
    .setTitle("What are you doing?")
    .setDescription(
      `${who}tap **Coding** or write it. Same options are on the study card in Dawn.`
    );
}

/** Button/modal replies must stay private — never edit a public VC ping. */
async function replyActivityOnlyToUser(
  interaction: ButtonInteraction,
  payload: {
    content: string;
    components?: ActionRowBuilder<ButtonBuilder>[];
  }
) {
  const body = {
    content: payload.content,
    embeds: [],
    components: payload.components,
  };

  const flags = interaction.message.flags;
  const alreadyPrivate =
    !interaction.inGuild() ||
    (typeof flags?.has === "function" && flags.has(MessageFlags.Ephemeral));

  if (!alreadyPrivate) {
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ ...body, ephemeral: true });
      } else {
        await interaction.reply({ ...body, ephemeral: true });
      }
    } catch {
      /* interaction expired */
    }
    await interaction.message.delete().catch(() => undefined);
    return;
  }

  try {
    if (interaction.message && !interaction.replied && !interaction.deferred) {
      await interaction.update(body);
      return;
    }
  } catch {
    /* fall through */
  }
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ ...body, ephemeral: true });
    } else {
      await interaction.reply({ ...body, ephemeral: true });
    }
  } catch {
    /* interaction expired */
  }
}

async function sendActivityAskToChannel(
  client: Client,
  channelId: string,
  discordId: string,
  embed: EmbedBuilder,
  rows: ReturnType<typeof activityAskRows>
): Promise<boolean> {
  const ch = await client.channels.fetch(channelId).catch((err) => {
    console.error("[study] channel fetch failed", channelId, err);
    return null;
  });
  if (!ch || !("send" in ch) || typeof ch.send !== "function") return false;
  const payload = {
    content: `<@${discordId}> what are you doing?`,
    embeds: [embed],
    components: rows,
    allowedMentions: { users: [discordId] },
  };
  try {
    await ch.send(payload);
    return true;
  } catch (err) {
    console.error("[study] ping with buttons failed", channelId, err);
    try {
      await ch.send({
        content: `<@${discordId}> what are you doing? Set it on the study card in Dawn, or /doing.`,
        allowedMentions: { users: [discordId] },
      });
      return true;
    } catch (err2) {
      console.error("[study] ping text failed", channelId, err2);
      return false;
    }
  }
}

const pingFailAt = new Map<string, number>();
const PING_RETRY_MS = 2 * 60 * 1000;

async function askWhatYouDoing(
  client: Client,
  prisma: PrismaClient,
  discordId: string,
  session: {
    id: string;
    channelId: string;
    activity?: string | null;
    activityKey?: string | null;
    activityAskedAt?: Date | null;
  },
  user: {
    name?: string | null;
    discordChannelId?: string | null;
    botMessagesJson?: string | null;
  }
) {
  if (studyActivityLabel(session)) return;
  if (session.activityAskedAt) return;
  const lastFail = pingFailAt.get(session.id) || 0;
  if (lastFail && Date.now() - lastFail < PING_RETRY_MS) return;

  const rows = activityAskRows(discordId);
  const embed = activityAskEmbed(user.name);
  const settings = parseBotMessages(user.botMessagesJson);
  const channelIds = collectChannelIds(
    session.channelId,
    settings.todosChannelId,
    user.discordChannelId,
    process.env.DISCORD_CHANNEL_ID
  );

  let delivered = false;
  for (const channelId of channelIds) {
    delivered = await sendActivityAskToChannel(
      client,
      channelId,
      discordId,
      embed,
      rows
    );
    if (delivered) break;
  }

  if (!delivered) {
    try {
      const discordUser = await client.users.fetch(discordId);
      await discordUser.send({
        content: "You joined a study room — what are you doing?",
        embeds: [embed],
        components: rows,
      });
      delivered = true;
    } catch (err) {
      console.error("[study] join ping DM failed", discordId, err);
    }
  }

  if (delivered) {
    pingFailAt.delete(session.id);
    await prisma.studySession
      .update({
        where: { id: session.id },
        data: { activityAskedAt: new Date() },
      })
      .catch((err) =>
        console.error("[study] mark asked failed", session.id, err)
      );
  } else {
    pingFailAt.set(session.id, Date.now());
    console.error(
      `[study] join ping did not land session=${session.id} vc=${session.channelId}`
    );
  }
}

async function applyLiveActivity(
  prisma: PrismaClient,
  userId: string,
  parsed: { key: string; label: string }
) {
  const open = await prisma.studySession.findFirst({
    where: { userId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (!open) return null;
  return prisma.studySession.update({
    where: { id: open.id },
    data: {
      activityKey: parsed.key,
      activity: parsed.label,
      activityAskedAt: open.activityAskedAt || new Date(),
    },
  });
}

async function closeSession(
  prisma: PrismaClient,
  session: { id: string; startedAt: Date; date: string },
  endedAt: Date,
  opts?: { ghost?: boolean }
) {
  const elapsed = endedAt.getTime() - session.startedAt.getTime();
  if (elapsed < MIN_SESSION_MS) {
    await prisma.studySession.delete({ where: { id: session.id } }).catch(() => undefined);
    return;
  }
  const capEnd = opts?.ghost
    ? new Date(
        session.startedAt.getTime() + Math.min(elapsed, MAX_SESSION_MS)
      )
    : endedAt.getTime() - session.startedAt.getTime() > MAX_SESSION_MS
      ? new Date(session.startedAt.getTime() + MAX_SESSION_MS)
      : endedAt;
  const minutes = sessionMinutes(session.startedAt, capEnd);
  await prisma.studySession.update({
    where: { id: session.id },
    data: { endedAt: capEnd, minutes },
  });
}

async function openSession(
  prisma: PrismaClient,
  user: { id: string; timezone: string },
  guildId: string,
  channelId: string
): Promise<StudySession> {
  const existing = await prisma.studySession.findFirst({
    where: { userId: user.id, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (existing) {
    if (existing.channelId === channelId) return existing;
    if (isWebStudySession(existing)) {
      return prisma.studySession.update({
        where: { id: existing.id },
        data: { guildId, channelId, source: "discord" },
      });
    }
    const carried = {
      activityKey: existing.activityKey,
      activity: existing.activity,
      activityAskedAt: existing.activityAskedAt,
    };
    await closeSession(prisma, existing, new Date());
    return prisma.studySession.create({
      data: {
        userId: user.id,
        guildId,
        channelId,
        source: "discord",
        date: todayInZone(user.timezone || DEFAULT_TZ),
        startedAt: new Date(),
        ...carried,
      },
    });
  }
  return prisma.studySession.create({
    data: {
      userId: user.id,
      guildId,
      channelId,
      source: "discord",
      date: todayInZone(user.timezone || DEFAULT_TZ),
      startedAt: new Date(),
    },
  });
}

const loginNudgeAt = new Map<string, number>();

async function nudgeDawnLogin(client: Client, discordId: string) {
  const last = loginNudgeAt.get(discordId) || 0;
  if (Date.now() - last < 12 * 60 * 60 * 1000) return;
  loginNudgeAt.set(discordId, Date.now());
  const base = (process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
  const url = base ? `${base}/login` : "Dawn → Login → Continue with Discord";
  try {
    const user = await client.users.fetch(discordId);
    await user.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf0b45a)
          .setTitle("Log into Dawn to count study time")
          .setDescription(
            `You’re in a study voice channel, but Dawn doesn’t have your account yet.\n\nOpen **${url}** and tap **Continue with Discord**. After that, time in this room is tracked and you appear on the Discord friends leaderboard.`
          ),
      ],
    });
  } catch {
    /* DMs closed */
  }
}

export async function handleVoiceStateUpdate(
  prisma: PrismaClient,
  client: Client,
  oldState: VoiceState,
  newState: VoiceState
) {
  const discordId = newState.id || oldState.id;
  if (!discordId) return;
  if (newState.member?.user?.bot || oldState.member?.user?.bot) return;

  const oldCh = oldState.channelId;
  const newCh = newState.channelId;
  if (oldCh === newCh) return;

  const [leftStudy, joinedStudy] = await Promise.all([
    isStudyRoom(prisma, oldCh),
    isStudyRoom(prisma, newCh),
  ]);
  if (!leftStudy && !joinedStudy) return;

  const user = await findDawnUser(prisma, discordId);
  if (!user) {
    if (joinedStudy) {
      console.log(`[study] join ignored — Discord ${discordId} is not linked in Dawn`);
      await nudgeDawnLogin(client, discordId);
    }
    return;
  }

  if (leftStudy && !joinedStudy) {
    const open = await prisma.studySession.findFirst({
      where: { userId: user.id, endedAt: null },
    });
    if (open) await closeSession(prisma, open, new Date());
    console.log(`[study] left user=${user.id} ch=${oldCh}`);
    return;
  }

  const guildId = newState.guild.id;
  if (joinedStudy && newCh) {
    const session = await openSession(prisma, user, guildId, newCh);
    console.log(`[study] joined user=${user.id} ch=${newCh}`);
    try {
      await askWhatYouDoing(client, prisma, discordId, session, user);
    } catch (err) {
      console.error("[study] join ping failed", user.id, err);
    }
  }
}

/**
 * Close leftover sessions AND start counting people already sitting in a
 * study VC. Join events are missed when the bot restarts while you're in the
 * room — that's why hours showed 0 even though you were in the channel.
 */
export async function reconcileOpenSessions(
  client: Client,
  prisma: PrismaClient
) {
  const rooms = await loadStudyRoomIds(prisma);
  if (!rooms.size) return;

  const present = await peopleInStudyRooms(client, rooms);
  const open = await prisma.studySession.findMany({
    where: { endedAt: null },
    include: {
      user: {
        select: {
          id: true,
          discordId: true,
          timezone: true,
          accounts: {
            where: { provider: "discord" },
            select: { providerAccountId: true },
          },
        },
      },
    },
  });
  const now = Date.now();
  const counted = new Set<string>();

  for (const session of open) {
    if (isWebStudySession(session)) {
      const ids = discordIdsForUser(session.user);
      const loc = ids.map((id) => present.get(id)).find(Boolean);
      if (loc) {
        await prisma.studySession.update({
          where: { id: session.id },
          data: {
            guildId: loc.guildId,
            channelId: loc.channelId,
            source: "discord",
          },
        });
        counted.add(session.user.id);
        for (const id of ids) present.delete(id);
        continue;
      }
      counted.add(session.user.id);
      continue;
    }
    const ids = discordIdsForUser(session.user);
    const loc = ids.map((id) => present.get(id)).find(Boolean);
    if (loc) {
      counted.add(session.user.id);
      for (const id of ids) present.delete(id);
      if (loc.channelId !== session.channelId || loc.guildId !== session.guildId) {
        await prisma.studySession.update({
          where: { id: session.id },
          data: { channelId: loc.channelId, guildId: loc.guildId },
        });
      }
      continue;
    }
    if (!ids.length) {
      console.log(`[study] open session ${session.id} has no Discord id — leaving it`);
      counted.add(session.user.id);
      continue;
    }
    const elapsed = now - session.startedAt.getTime();
    await closeSession(prisma, session, new Date(), {
      ghost: elapsed > MAX_SESSION_MS,
    });
  }

  for (const [discordId, loc] of present) {
    const user = await findDawnUser(prisma, discordId);
    if (!user || counted.has(user.id)) continue;
    const session = await openSession(prisma, user, loc.guildId, loc.channelId);
    counted.add(user.id);
    console.log(`[study] recovered occupant user=${user.id} ch=${loc.channelId}`);
    try {
      await askWhatYouDoing(client, prisma, discordId, session, user);
    } catch (err) {
      console.error("[study] recover ping failed", user.id, err);
    }
  }
}

export function attachStudyVoice(client: Client, prisma: PrismaClient) {
  client.on("voiceStateUpdate", (oldState, newState) => {
    void handleVoiceStateUpdate(prisma, client, oldState, newState).catch((e) =>
      console.error("study voice update failed", e)
    );
  });

  const sweep = () =>
    void reconcileOpenSessions(client, prisma).catch((e) =>
      console.error("study voice reconcile failed", e)
    );

  const boot = () => {
    console.log("Study voice tracking ready");
    void prisma.studySession
      .updateMany({
        where: {
          endedAt: null,
          activity: null,
          activityKey: null,
        },
        data: { activityAskedAt: null },
      })
      .catch((err) => console.error("[study] reset asked-at failed", err))
      .finally(() => {
        sweep();
        setTimeout(sweep, 8_000);
      });
  };

  if (client.isReady()) boot();
  client.on("ready", boot);
  setInterval(sweep, 60_000);
}

export async function handleStudyRoomCommand(
  prisma: PrismaClient,
  interaction: ChatInputCommandInteraction
) {
  const sub = interaction.options.getSubcommand();
  console.log(`[cmd] study-room ${sub} guild=${interaction.guildId || "none"}`);
  if (!interaction.guildId) {
    await safeRespond(interaction, "Run this in your study server.");
    return;
  }

  if (sub === "list") {
    const rows = await prisma.studyRoom.findMany({
      where: { guildId: interaction.guildId },
      orderBy: { createdAt: "asc" },
    });
    const envIds = envStudyVoiceIds();
    const lines = [
      ...rows.map((r) => `• **${r.name}** \`${r.channelId}\``),
      ...envIds
        .filter((id) => !rows.some((r) => r.channelId === id))
        .map((id) => `• env \`${id}\``),
    ];
    await safeRespond(
      interaction,
      lines.length
        ? `**Study voice rooms**\n${lines.join("\n")}\n\nSit in one of these — Dawn counts time while the bot is online.`
        : "No study rooms yet. Use `/study-room add` and pick a voice channel."
    );
    return;
  }

  const canManage = Boolean(
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)
  );
  if (!canManage) {
    await safeRespond(
      interaction,
      "Need **Manage Channels** to add or remove study rooms."
    );
    return;
  }

  const channel = interaction.options.getChannel("channel", true);
  if (
    channel.type !== ChannelType.GuildVoice &&
    channel.type !== ChannelType.GuildStageVoice
  ) {
    await safeRespond(interaction, "Pick a **voice** channel.");
    return;
  }

  if (sub === "add") {
    await prisma.studyRoom.upsert({
      where: { channelId: channel.id },
      create: {
        guildId: interaction.guildId,
        channelId: channel.id,
        name: "name" in channel ? String(channel.name) : "Study",
        addedById: interaction.user.id,
      },
      update: {
        guildId: interaction.guildId,
        name: "name" in channel ? String(channel.name) : "Study",
      },
    });
    invalidateStudyRoomCache();
    const name = "name" in channel ? channel.name : "that VC";
    console.log(`[cmd] study-room saved ${channel.id} ${name}`);
    await safeRespond(
      interaction,
      `Counting **${name}** as study time. Join it with Discord linked in Dawn.`
    );
    return;
  }

  if (sub === "remove") {
    const deleted = await prisma.studyRoom.deleteMany({
      where: { channelId: channel.id, guildId: interaction.guildId },
    });
    invalidateStudyRoomCache();
    await safeRespond(
      interaction,
      deleted.count
        ? `Stopped counting **${"name" in channel ? channel.name : "that VC"}**.`
        : "That channel was not a study room."
    );
  }
}

export async function handleStudiedCommand(
  prisma: PrismaClient,
  interaction: ChatInputCommandInteraction
) {
  const user = await findDawnUser(prisma, interaction.user.id);
  if (!user) {
    await safeRespond(
      interaction,
      "Link Discord in Dawn first (open the app → Login with Discord), then sit in a marked study VC."
    );
    return;
  }

  const tz = user.timezone || DEFAULT_TZ;
  const today = todayInZone(tz);
  const weekDates = lastNDates(today, 7);
  const since = weekDates[0];
  const now = new Date();

  const sessions = await prisma.studySession.findMany({
    where: {
      userId: user.id,
      OR: [{ date: { gte: since } }, { endedAt: null }],
    },
  });

  const byDate = new Map<string, number>();
  for (const d of weekDates) byDate.set(d, 0);

  for (const s of sessions) {
    const end = s.endedAt || now;
    for (const d of weekDates) {
      byDate.set(
        d,
        (byDate.get(d) || 0) +
          minutesOnLocalDate({
            startedAt: s.startedAt,
            endedAt: end,
            date: d,
            timeZone: tz,
          })
      );
    }
  }

  const todayMin = byDate.get(today) || 0;
  const weekMin = [...byDate.values()].reduce((a, b) => a + b, 0);
  const liveSession = sessions.find((s) => !s.endedAt);
  const live = Boolean(liveSession);
  const doing = liveSession ? studyActivityLabel(liveSession) : null;
  const weekLines = weekDates.map((d) => {
    const m = Math.round(byDate.get(d) || 0);
    const mark = d === today ? " ←" : "";
    return `${d.slice(5)}  ${formatStudyDuration(m)}${mark}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0xf0b45a)
    .setTitle("Study time")
    .setDescription(
      [
        `**Today** ${formatStudyDuration(todayMin)}${live ? " · in a study session now" : ""}`,
        doing ? `**Doing** ${doing}` : null,
        `**This week** ${formatStudyDuration(weekMin)}`,
        "",
        weekLines.join("\n"),
      ]
        .filter(Boolean)
        .join("\n")
    )
    .setFooter({
      text: live
        ? "Change what you’re doing on the study card in Dawn, or /doing."
        : "Dawn tracks marked study VCs — not LionBot. Bot must stay online.",
    });

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  } catch {
    await safeRespond(
      interaction,
      `**Today** ${formatStudyDuration(todayMin)}${live ? " · live" : ""}${doing ? ` · ${doing}` : ""}\n**This week** ${formatStudyDuration(weekMin)}`
    );
  }
}

export async function handleDoingCommand(
  prisma: PrismaClient,
  interaction: ChatInputCommandInteraction
) {
  const user = await findDawnUser(prisma, interaction.user.id);
  if (!user) {
    await safeRespond(
      interaction,
      "Link Discord in Dawn first, then join a study room — or start a session on Today in the app."
    );
    return;
  }

  const open = await prisma.studySession.findFirst({
    where: { userId: user.id, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (!open) {
    await safeRespond(
      interaction,
      "No live session. Join a marked study voice channel, or tap **Start** on Today in Dawn."
    );
    return;
  }

  const what = interaction.options.getString("what");
  if (what) {
    const parsed = normalizeStudyActivity({ text: what });
    if (!parsed) {
      await safeRespond(interaction, "Write what you’re doing, or pick a button.");
      return;
    }
    await applyLiveActivity(prisma, user.id, parsed);
    await safeRespond(interaction, `Logged **${parsed.label}**. Keep going.`);
    return;
  }

  const current = studyActivityLabel(open);
  const payload = {
    content: current
      ? `This session is **${current}**. Change it:`
      : "What are you doing?",
    embeds: [activityAskEmbed(user.name)],
    components: activityAskRows(interaction.user.id, open.activityKey),
  };
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload);
    } else {
      await interaction.reply({ ...payload, ephemeral: true });
    }
  } catch {
    await safeRespond(
      interaction,
      current
        ? `This session is **${current}**. Change it on the study card in Dawn, or /doing.`
        : "Set what you’re doing on the study card in Dawn, or /doing.";
    );
  }
}

export function isStudyActivityCustomId(customId: string): boolean {
  return customId.startsWith("st:") || customId.startsWith("st_modal:");
}

export async function handleStudyActivityButton(
  prisma: PrismaClient,
  interaction: ButtonInteraction
) {
  const parts = interaction.customId.split(":");
  const key = parts[1] || "";
  const forDiscordId = parts[2] || "";
  if (forDiscordId && forDiscordId !== interaction.user.id) {
    await interaction.reply({
      content: "That ping is for someone else.",
      ephemeral: true,
    });
    return;
  }

  if (key === "other") {
    await interaction.showModal(activityModal(interaction.user.id));
    return;
  }

  const parsed = normalizeStudyActivity({ key });
  if (!parsed) {
    await interaction.reply({
      content: "Pick Coding, or write what you’re doing.",
      ephemeral: true,
    });
    return;
  }

  const user = await findDawnUser(prisma, interaction.user.id);
  if (!user) {
    await interaction.reply({
      content: "Link Discord in Dawn first (Login → Continue with Discord).",
      ephemeral: true,
    });
    return;
  }

  const saved = await applyLiveActivity(prisma, user.id, parsed);
  if (!saved) {
    await interaction.reply({
      content:
        "No live session. Join a study voice channel, or start one on Today in Dawn.",
      ephemeral: true,
    });
    return;
  }

  await replyActivityOnlyToUser(interaction, {
    content: `This session is **${parsed.label}**. Only you can see this.`,
    components: activityAskRows(interaction.user.id, parsed.key),
  });
}

export async function handleStudyActivityModal(
  prisma: PrismaClient,
  interaction: ModalSubmitInteraction
) {
  const forDiscordId = interaction.customId.split(":")[1] || "";
  if (forDiscordId && forDiscordId !== interaction.user.id) {
    await interaction.reply({
      content: "That prompt is for someone else.",
      ephemeral: true,
    });
    return;
  }

  const text = interaction.fields.getTextInputValue("text");
  const parsed = normalizeStudyActivity({ text });
  if (!parsed) {
    await interaction.reply({
      content: "Write a short note about what you’re doing.",
      ephemeral: true,
    });
    return;
  }

  const user = await findDawnUser(prisma, interaction.user.id);
  if (!user) {
    await interaction.reply({
      content: "Link Discord in Dawn first.",
      ephemeral: true,
    });
    return;
  }

  const saved = await applyLiveActivity(prisma, user.id, parsed);
  await interaction.reply({
    content: saved
      ? `Logged **${parsed.label}**. Only you can see this.`
      : "No live session. Join a study voice channel, or start one on Today in Dawn.",
    ephemeral: true,
  });
  if (interaction.message?.inGuild()) {
    await interaction.message.delete().catch(() => undefined);
  }
}
