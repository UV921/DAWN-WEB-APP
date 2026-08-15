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

export async function handleVoiceStateUpdate(
  prisma: PrismaClient,
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
  if (!user) return;

  if (leftStudy && !joinedStudy) {
    const open = await prisma.studySession.findFirst({
      where: { userId: user.id, endedAt: null },
    });
    if (open) await closeSession(prisma, open, new Date());
    return;
  }

  const guildId = newState.guild.id;
  if (joinedStudy && newCh) {
    await openSession(prisma, user, guildId, newCh);
  }
}

export async function reconcileOpenSessions(
  client: Client,
  prisma: PrismaClient
) {
  const open = await prisma.studySession.findMany({
    where: { endedAt: null },
    include: {
      user: { select: { discordId: true, timezone: true } },
    },
  });
  if (!open.length) return;

  const rooms = await loadStudyRoomIds(prisma);
  const now = Date.now();

  for (const session of open) {
    const discordId = session.user.discordId;
    if (!discordId) {
      await closeSession(prisma, session, new Date(), { ghost: true });
      continue;
    }

    let stillIn = false;
    let currentCh: string | null = null;
    try {
      const guild = await client.guilds.fetch(session.guildId);
      const member = await guild.members.fetch(discordId);
      currentCh = member.voice.channelId;
      stillIn = Boolean(currentCh && rooms.has(currentCh));
    } catch {
      stillIn = false;
    }

    if (stillIn && currentCh) {
      if (currentCh !== session.channelId) {
        await prisma.studySession.update({
          where: { id: session.id },
          data: { channelId: currentCh },
        });
      }
      continue;
    }

    const elapsed = now - session.startedAt.getTime();
    await closeSession(prisma, session, new Date(), {
      ghost: elapsed > MAX_SESSION_MS,
    });
  }
}

export function attachStudyVoice(client: Client, prisma: PrismaClient) {
  client.on("voiceStateUpdate", (oldState, newState) => {
    void handleVoiceStateUpdate(prisma, oldState, newState).catch((e) =>
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
  });
  setInterval(sweep, 60_000);
}

export async function handleStudyRoomCommand(
  prisma: PrismaClient,
  interaction: ChatInputCommandInteraction
) {
  const sub = interaction.options.getSubcommand();
  if (!interaction.guildId) {
    await interaction.reply({
      content: "Run this in your study server.",
      ephemeral: true,
    });
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
    await interaction.reply({
      content: lines.length
        ? `**Study voice rooms**\n${lines.join("\n")}\n\nSit in one of these — Dawn counts time while the bot is online.`
        : "No study rooms yet. Use `/study-room add` and pick a voice channel.",
      ephemeral: true,
    });
    return;
  }

  const canManage = Boolean(
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)
  );
  if (!canManage) {
    await interaction.reply({
      content: "Need **Manage Channels** to add or remove study rooms.",
      ephemeral: true,
    });
    return;
  }

  const channel = interaction.options.getChannel("channel", true);
  if (
    channel.type !== ChannelType.GuildVoice &&
    channel.type !== ChannelType.GuildStageVoice
  ) {
    await interaction.reply({
      content: "Pick a **voice** channel.",
      ephemeral: true,
    });
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
    await interaction.reply({
      content: `Counting **${"name" in channel ? channel.name : "that VC"}** as study time. Join it with Discord linked in Dawn.`,
      ephemeral: true,
    });
    return;
  }

  if (sub === "remove") {
    const deleted = await prisma.studyRoom.deleteMany({
      where: { channelId: channel.id, guildId: interaction.guildId },
    });
    invalidateStudyRoomCache();
    await interaction.reply({
      content: deleted.count
        ? `Stopped counting **${"name" in channel ? channel.name : "that VC"}**.`
        : "That channel was not a study room.",
      ephemeral: true,
    });
  }
}

export async function handleStudiedCommand(
  prisma: PrismaClient,
  interaction: ChatInputCommandInteraction
) {
  const user = await findDawnUser(prisma, interaction.user.id);
  if (!user) {
    await interaction.reply({
      content:
        "Link Discord in Dawn first (open the app → Login with Discord), then sit in a marked study VC.",
      ephemeral: true,
    });
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

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
