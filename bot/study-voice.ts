/**
 * Track time in marked study voice channels.
 * Counts only existing Dawn users (discordId linked). Bot must stay online.
 */
import {
  ChannelType,
  Client,
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type VoiceState,
} from "discord.js";
import type { PrismaClient } from "@prisma/client";
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
    select: { id: true, timezone: true, discordId: true, name: true },
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
) {
  const existing = await prisma.studySession.findFirst({
    where: { userId: user.id, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (existing) {
    if (existing.channelId === channelId) return;
    await closeSession(prisma, existing, new Date());
  }
  await prisma.studySession.create({
    data: {
      userId: user.id,
      guildId,
      channelId,
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
    await openSession(prisma, user, guildId, newCh);
    console.log(`[study] joined user=${user.id} ch=${newCh}`);
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
    await openSession(prisma, user, loc.guildId, loc.channelId);
    counted.add(user.id);
    console.log(`[study] recovered occupant user=${user.id} ch=${loc.channelId}`);
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

  if (client.isReady()) sweep();
  client.on("ready", () => {
    console.log("Study voice tracking ready");
    sweep();
    setTimeout(sweep, 8_000);
  });
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
  const live = sessions.some((s) => !s.endedAt);
  const weekLines = weekDates.map((d) => {
    const m = Math.round(byDate.get(d) || 0);
    const mark = d === today ? " ←" : "";
    return `${d.slice(5)}  ${formatStudyDuration(m)}${mark}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0xf0b45a)
    .setTitle("Study time")
    .setDescription(
      `**Today** ${formatStudyDuration(todayMin)}${live ? " · in a study VC now" : ""}\n**This week** ${formatStudyDuration(weekMin)}\n\n${weekLines.join("\n")}`
    )
    .setFooter({
      text: "Dawn tracks marked study VCs — not LionBot. Bot must stay online.",
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
      `**Today** ${formatStudyDuration(todayMin)}${live ? " · live" : ""}\n**This week** ${formatStudyDuration(weekMin)}`
    );
  }
}
