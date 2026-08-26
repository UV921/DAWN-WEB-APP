import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normChannelId } from "@/lib/bot-messages";
import {
  collectGuildIds,
  fetchDiscordChannel,
  fetchGuildAccess,
  isBoardHhmm,
  type GuildManageReason,
  type MorningBoardFlags,
  type MorningBoardRow,
} from "@/lib/discord-guild";

const FLAG_KEYS = [
  "pingEnabled",
  "boardEnabled",
  "reviewEnabled",
  "reportEnabled",
] as const satisfies readonly (keyof MorningBoardFlags)[];

function envGuildId() {
  return process.env.DISCORD_GUILD_ID?.trim() || "";
}

async function requireDiscordUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, discordId: true, discordChannelId: true },
  });
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user };
}

async function accessForGuilds(discordUserId: string, guildIds: string[]) {
  const byGuild = new Map<
    string,
    {
      canManage: boolean;
      isOwner: boolean;
      reason: GuildManageReason | null;
      guildName: string | null;
    }
  >();
  await Promise.all(
    guildIds.map(async (guildId) => {
      const access = await fetchGuildAccess({ guildId, discordUserId });
      byGuild.set(guildId, access);
    })
  );
  return byGuild;
}

export async function GET() {
  const auth = await requireDiscordUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!user.discordId) {
    return NextResponse.json({
      canManage: false,
      isOwner: false,
      reason: null,
      linkedDiscord: false,
      boards: [] as MorningBoardRow[],
      hint: "Sign in with Discord to manage server wake pings.",
    });
  }

  const stored = await prisma.trackedChannel.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { members: true } } },
  });
  const guildIds = collectGuildIds({
    envGuildId: envGuildId(),
    boardGuildIds: stored.map((b) => b.guildId),
  });
  const accessByGuild = await accessForGuilds(user.discordId, guildIds);

  const managed = [...accessByGuild.entries()].filter(([, a]) => a.canManage);
  const canManage = managed.length > 0;
  const ownerEntry = managed.find(([, a]) => a.isOwner);
  const first = ownerEntry || managed[0];

  const boards: MorningBoardRow[] = stored
    .filter((b) => accessByGuild.get(b.guildId)?.canManage)
    .map((b) => ({
      id: b.id,
      channelId: b.channelId,
      guildId: b.guildId,
      name: b.name,
      pingTime: b.pingTime,
      leaderboardTime: b.leaderboardTime,
      reviewTime: b.reviewTime,
      reportTime: b.reportTime,
      pingEnabled: b.pingEnabled,
      boardEnabled: b.boardEnabled,
      reviewEnabled: b.reviewEnabled,
      reportEnabled: b.reportEnabled,
      memberCount: b._count.members,
      guildName: accessByGuild.get(b.guildId)?.guildName || null,
    }));

  return NextResponse.json({
    canManage,
    isOwner: Boolean(first?.[1].isOwner),
    reason: first?.[1].reason || null,
    linkedDiscord: true,
    boards,
    hint: canManage
      ? null
      : "Only the Discord server owner, or someone with Manage Server, can turn these pings on or off.",
  });
}

export async function PATCH(req: Request) {
  const auth = await requireDiscordUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!user.discordId) {
    return NextResponse.json(
      { error: "Sign in with Discord to change server pings." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  let board =
    typeof body.id === "string"
      ? await prisma.trackedChannel.findUnique({ where: { id: body.id } })
      : null;

  if (!board && typeof body.channelId === "string") {
    const channelId = normChannelId(body.channelId);
    if (channelId) {
      board = await prisma.trackedChannel.findUnique({ where: { channelId } });
      if (!board) {
        const ch = await fetchDiscordChannel(channelId);
        if (!ch) {
          return NextResponse.json(
            {
              error:
                "Could not find that channel. The Dawn bot must be in the server, and the ID must be a text channel.",
            },
            { status: 400 }
          );
        }
        const access = await fetchGuildAccess({
          guildId: ch.guildId,
          discordUserId: user.discordId,
        });
        if (!access.canManage) {
          return NextResponse.json(
            {
              error:
                "Only the Discord owner or someone with Manage Server can set up the morning board.",
            },
            { status: 403 }
          );
        }
        board = await prisma.trackedChannel.create({
          data: {
            channelId: ch.id,
            guildId: ch.guildId,
            name: ch.name || "Morning board",
            pingEnabled: false,
            boardEnabled: false,
            reviewEnabled: false,
            reportEnabled: false,
          },
        });
      }
    }
  }

  if (!board) {
    return NextResponse.json(
      { error: "No morning board found. Run /track in Discord or paste a channel ID." },
      { status: 404 }
    );
  }

  const access = await fetchGuildAccess({
    guildId: board.guildId,
    discordUserId: user.discordId,
  });
  if (!access.canManage) {
    return NextResponse.json(
      {
        error:
          "Only the Discord owner or someone with Manage Server can change these pings.",
      },
      { status: 403 }
    );
  }

  const data: {
    pingEnabled?: boolean;
    boardEnabled?: boolean;
    reviewEnabled?: boolean;
    reportEnabled?: boolean;
    pingTime?: string;
    leaderboardTime?: string;
    reviewTime?: string;
    reportTime?: string;
    name?: string;
  } = {};

  if (typeof body.allEnabled === "boolean") {
    for (const key of FLAG_KEYS) data[key] = body.allEnabled;
  }
  for (const key of FLAG_KEYS) {
    if (typeof body[key] === "boolean") data[key] = body[key];
  }
  if (isBoardHhmm(body.pingTime)) data.pingTime = body.pingTime.trim();
  if (isBoardHhmm(body.leaderboardTime))
    data.leaderboardTime = body.leaderboardTime.trim();
  if (isBoardHhmm(body.reviewTime)) data.reviewTime = body.reviewTime.trim();
  if (isBoardHhmm(body.reportTime)) data.reportTime = body.reportTime.trim();
  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim().slice(0, 80);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await prisma.trackedChannel.update({
    where: { id: board.id },
    data,
    include: { _count: { select: { members: true } } },
  });

  const row: MorningBoardRow = {
    id: updated.id,
    channelId: updated.channelId,
    guildId: updated.guildId,
    name: updated.name,
    pingTime: updated.pingTime,
    leaderboardTime: updated.leaderboardTime,
    reviewTime: updated.reviewTime,
    reportTime: updated.reportTime,
    pingEnabled: updated.pingEnabled,
    boardEnabled: updated.boardEnabled,
    reviewEnabled: updated.reviewEnabled,
    reportEnabled: updated.reportEnabled,
    memberCount: updated._count.members,
    guildName: access.guildName,
  };

  return NextResponse.json({
    ok: true,
    canManage: true,
    isOwner: access.isOwner,
    reason: access.reason,
    board: row,
  });
}
