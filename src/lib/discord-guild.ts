/**
 * Discord server (guild) access for Dawn’s morning board.
 *
 * The wake / “who’s up” pings are server-wide. Only the guild owner, or a
 * member with Administrator / Manage Server, can turn them on or off.
 */

import { isDiscordSnowflake, normChannelId } from "./bot-messages";

/** Discord permission bits (snowflakes are strings; bits need BigInt). */
export const DISCORD_PERM = {
  ADMINISTRATOR: BigInt(8),
  MANAGE_GUILD: BigInt(32),
} as const;

export type GuildManageReason = "owner" | "administrator" | "manage_guild";

export type GuildAccess = {
  canManage: boolean;
  isOwner: boolean;
  reason: GuildManageReason | null;
};

export type MorningBoardFlags = {
  pingEnabled: boolean;
  boardEnabled: boolean;
  reviewEnabled: boolean;
  reportEnabled: boolean;
};

export const DEFAULT_BOARD_FLAGS: MorningBoardFlags = {
  pingEnabled: true,
  boardEnabled: true,
  reviewEnabled: true,
  reportEnabled: true,
};

/** Accidental boards (login /join) should not start pinging the server. */
export const QUIET_BOARD_FLAGS: MorningBoardFlags = {
  pingEnabled: false,
  boardEnabled: false,
  reviewEnabled: false,
  reportEnabled: false,
};

export type MorningBoardRow = MorningBoardFlags & {
  id: string;
  channelId: string;
  guildId: string;
  name: string;
  pingTime: string;
  leaderboardTime: string;
  reviewTime: string;
  reportTime: string;
  memberCount: number;
  guildName: string | null;
};

function botToken() {
  return process.env.DISCORD_BOT_TOKEN?.trim() || "";
}

export function roleGrantsManage(permissions: string | number | bigint): boolean {
  try {
    const bits = BigInt(permissions);
    return (
      (bits & DISCORD_PERM.ADMINISTRATOR) !== BigInt(0) ||
      (bits & DISCORD_PERM.MANAGE_GUILD) !== BigInt(0)
    );
  } catch {
    return false;
  }
}

/**
 * Pure access check. `memberRoleIds: null` means we could not read the
 * member — only the guild owner is trusted in that case.
 */
export function resolveGuildAccess(opts: {
  discordUserId: string;
  ownerId: string;
  guildId?: string;
  memberRoleIds: string[] | null;
  roles: { id: string; permissions: string }[];
}): GuildAccess {
  const isOwner =
    Boolean(opts.discordUserId) && opts.discordUserId === opts.ownerId;
  if (isOwner) {
    return { canManage: true, isOwner: true, reason: "owner" };
  }
  if (!opts.memberRoleIds) {
    return { canManage: false, isOwner: false, reason: null };
  }

  const roleIds = new Set(opts.memberRoleIds);
  if (opts.guildId) roleIds.add(opts.guildId);

  let sawManageGuild = false;
  for (const role of opts.roles) {
    if (!roleIds.has(role.id)) continue;
    try {
      const bits = BigInt(role.permissions);
      if ((bits & DISCORD_PERM.ADMINISTRATOR) !== BigInt(0)) {
        return { canManage: true, isOwner: false, reason: "administrator" };
      }
      if ((bits & DISCORD_PERM.MANAGE_GUILD) !== BigInt(0)) {
        sawManageGuild = true;
      }
    } catch {
      /* ignore bad bitfields */
    }
  }
  if (sawManageGuild) {
    return { canManage: true, isOwner: false, reason: "manage_guild" };
  }
  return { canManage: false, isOwner: false, reason: null };
}

export function parseBoardFlags(
  raw: Partial<MorningBoardFlags> | null | undefined
): MorningBoardFlags {
  return {
    pingEnabled: raw?.pingEnabled !== false,
    boardEnabled: raw?.boardEnabled !== false,
    reviewEnabled: raw?.reviewEnabled !== false,
    reportEnabled: raw?.reportEnabled !== false,
  };
}

/** Auto scheduler: skip when the owner turned that ping off. Manual force still sends. */
export function shouldAutoRunBoardJob(
  enabled: boolean | null | undefined,
  opts?: { force?: boolean }
): boolean {
  if (opts?.force) return true;
  return enabled !== false;
}

export function isBoardHhmm(raw: unknown): raw is string {
  return typeof raw === "string" && /^\d{2}:\d{2}$/.test(raw.trim());
}

type DiscordGuild = { id: string; name?: string; owner_id?: string };
type DiscordMember = { roles?: string[] };
type DiscordRole = { id: string; permissions: string };
type DiscordChannel = { id: string; name?: string; guild_id?: string; type?: number };

async function discordGet<T>(
  path: string
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const token = botToken();
  if (!token) {
    return { ok: false, status: 0, error: "DISCORD_BOT_TOKEN is not set." };
  }
  try {
    const res = await fetch(`https://discord.com/api/v10${path}`, {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        status: res.status,
        error: text.slice(0, 280) || `Discord ${res.status}`,
      };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : "Discord request failed",
    };
  }
}

const accessCache = new Map<
  string,
  { at: number; access: GuildAccess; guildName: string | null }
>();
const ACCESS_TTL_MS = 30_000;

export async function fetchGuildAccess(opts: {
  guildId: string;
  discordUserId: string;
}): Promise<GuildAccess & { guildName: string | null; error?: string }> {
  const guildId = String(opts.guildId || "").trim();
  const discordUserId = String(opts.discordUserId || "").trim();
  if (!isDiscordSnowflake(guildId) || !isDiscordSnowflake(discordUserId)) {
    return {
      canManage: false,
      isOwner: false,
      reason: null,
      guildName: null,
      error: "Missing Discord server or user id.",
    };
  }

  const cacheKey = `${guildId}:${discordUserId}`;
  const hit = accessCache.get(cacheKey);
  if (hit && Date.now() - hit.at < ACCESS_TTL_MS) {
    return { ...hit.access, guildName: hit.guildName };
  }

  const guild = await discordGet<DiscordGuild>(`/guilds/${guildId}`);
  if (!guild.ok) {
    return {
      canManage: false,
      isOwner: false,
      reason: null,
      guildName: null,
      error: guild.error,
    };
  }

  const member = await discordGet<DiscordMember>(
    `/guilds/${guildId}/members/${discordUserId}`
  );
  const roles = await discordGet<DiscordRole[]>(`/guilds/${guildId}/roles`);

  const access = resolveGuildAccess({
    discordUserId,
    ownerId: guild.data.owner_id || "",
    guildId,
    memberRoleIds: member.ok ? member.data.roles || [] : null,
    roles: roles.ok ? roles.data : [],
  });
  const guildName = guild.data.name || null;
  accessCache.set(cacheKey, { at: Date.now(), access, guildName });
  return { ...access, guildName };
}

export async function fetchDiscordChannel(
  channelId: string
): Promise<{ id: string; name: string; guildId: string } | null> {
  const id = normChannelId(channelId);
  if (!id) return null;
  const ch = await discordGet<DiscordChannel>(`/channels/${id}`);
  if (!ch.ok || !ch.data.guild_id) return null;
  return {
    id: ch.data.id,
    name: ch.data.name || "Morning board",
    guildId: ch.data.guild_id,
  };
}

export function collectGuildIds(opts: {
  envGuildId?: string | null;
  boardGuildIds: string[];
}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [opts.envGuildId, ...opts.boardGuildIds]) {
    const id = String(raw || "").trim();
    if (!isDiscordSnowflake(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
