import { prisma } from "@/lib/prisma";
import { discordFriendsInviteCode } from "@/lib/circle-invite";
import { randomInviteCode } from "@/lib/habits";

export const GOOGLE_FRIEND_STEPS = [
  "You and your friend both sign in with Google (Discord works too — the code is the same).",
  "Open Friends. Your friend code is waiting — copy it or share the link.",
  "Send that code on WhatsApp, text, or anywhere.",
  "They open Friends, paste your code, tap Add friend.",
  "You’re on the same board: habit consistency and study hours.",
];

export type FriendSuggestion = {
  id: string;
  name: string | null;
  image: string | null;
  discordId: string | null;
  reason: "same-server" | "on-discord" | "on-dawn";
  reasonLabel: string;
};

export type DiscordGroupInfo = {
  circleId: string | null;
  name: string;
  inviteCode: string | null;
  memberCount: number;
  inGroup: boolean;
  hasGuild: boolean;
};

const SUGGEST_SELECT = {
  id: true,
  name: true,
  image: true,
  discordId: true,
} as const;

export async function uniqueCircleInviteCode() {
  let inviteCode = randomInviteCode();
  for (let i = 0; i < 8; i++) {
    const exists = await prisma.accountabilityCircle.findUnique({
      where: { inviteCode },
    });
    if (!exists) return inviteCode;
    inviteCode = randomInviteCode();
  }
  return randomInviteCode(10);
}

/** Every user gets a home circle so Google friends can share a code with no extra setup. */
export async function ensureHomeCircle(userId: string, name?: string | null) {
  const owned = await prisma.accountabilityCircle.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: "asc" },
  });
  if (owned) return owned;

  const member = await prisma.circleMember.findFirst({
    where: { userId },
    include: { circle: true },
    orderBy: { joinedAt: "asc" },
  });
  if (member?.circle) return member.circle;

  const label = String(name || "")
    .trim()
    .split(/\s+/)[0]
    .slice(0, 24);
  return prisma.accountabilityCircle.create({
    data: {
      name: label ? `${label}’s friends` : "Friends",
      inviteCode: await uniqueCircleInviteCode(),
      ownerId: userId,
      members: { create: { userId } },
    },
  });
}

export async function userHasGoogle(userId: string) {
  const row = await prisma.account.findFirst({
    where: { userId, provider: "google" },
    select: { id: true },
  });
  return Boolean(row);
}

export async function getDiscordGroupInfo(
  userId: string
): Promise<DiscordGroupInfo> {
  const inviteCode = discordFriendsInviteCode();
  const hasGuild = Boolean(process.env.DISCORD_GUILD_ID?.trim());
  if (!inviteCode) {
    return {
      circleId: null,
      name: "Discord server",
      inviteCode: null,
      memberCount: 0,
      inGroup: false,
      hasGuild,
    };
  }
  const circle = await prisma.accountabilityCircle.findUnique({
    where: { inviteCode },
    include: { _count: { select: { members: true } } },
  });
  if (!circle) {
    return {
      circleId: null,
      name: "Discord friends",
      inviteCode,
      memberCount: 0,
      inGroup: false,
      hasGuild,
    };
  }
  const membership = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId: circle.id, userId } },
  });
  return {
    circleId: circle.id,
    name: circle.name,
    inviteCode: circle.inviteCode,
    memberCount: circle._count.members,
    inGroup: Boolean(membership),
    hasGuild,
  };
}

/** Dawn users who share your Discord board, or who signed in with Discord. */
export async function listFriendSuggestions(opts: {
  meId: string;
  limit?: number;
}): Promise<FriendSuggestion[]> {
  const limit = opts.limit ?? 24;
  const me = await prisma.user.findUnique({
    where: { id: opts.meId },
    select: { discordId: true },
  });

  const myTracks = await prisma.trackedMember.findMany({
    where: { userId: opts.meId },
    include: { channel: { select: { guildId: true } } },
  });
  const guildIds = [
    ...new Set(
      [
        ...myTracks.map((t) => t.channel.guildId),
        process.env.DISCORD_GUILD_ID?.trim() || "",
      ].filter(Boolean)
    ),
  ];

  const sameServerIds = new Set<string>();
  if (guildIds.length > 0) {
    const channels = await prisma.trackedChannel.findMany({
      where: { guildId: { in: guildIds } },
      select: { id: true },
    });
    const members = await prisma.trackedMember.findMany({
      where: {
        trackedChannelId: { in: channels.map((c) => c.id) },
        userId: { not: opts.meId },
      },
      select: { userId: true },
    });
    for (const m of members) sameServerIds.add(m.userId);
  }

  const discordUsers = me?.discordId
    ? await prisma.user.findMany({
        where: {
          id: { not: opts.meId },
          discordId: { not: null },
          OR: [{ onboardingDone: true }, { id: { in: [...sameServerIds] } }],
        },
        select: SUGGEST_SELECT,
        take: 80,
        orderBy: { updatedAt: "desc" },
      })
    : [];

  const byId = new Map<string, FriendSuggestion>();
  for (const u of discordUsers) {
    const same = sameServerIds.has(u.id);
    byId.set(u.id, {
      ...u,
      reason: same ? "same-server" : "on-discord",
      reasonLabel: same
        ? "Same Discord server"
        : "On Discord · Dawn",
    });
  }

  // Include tracked same-server people even if they were filtered out above
  const missingSame = [...sameServerIds].filter((id) => !byId.has(id));
  if (missingSame.length > 0) {
    const extra = await prisma.user.findMany({
      where: { id: { in: missingSame } },
      select: SUGGEST_SELECT,
    });
    for (const u of extra) {
      byId.set(u.id, {
        ...u,
        reason: "same-server",
        reasonLabel: "Same Discord server",
      });
    }
  }

  const ranked = [...byId.values()].sort((a, b) => {
    if (a.reason !== b.reason) {
      return a.reason === "same-server" ? -1 : 1;
    }
    return (a.name || "").localeCompare(b.name || "");
  });
  return ranked.slice(0, limit);
}

export async function searchDiscordFriends(opts: {
  meId: string;
  query: string;
  excludeIds?: string[];
  limit?: number;
}) {
  const q = opts.query.trim();
  if (q.length < 1) return [];
  const exclude = new Set([opts.meId, ...(opts.excludeIds || [])]);
  const snowflake = /^\d{17,20}$/.test(q) ? q : null;

  const matches = await prisma.user.findMany({
    where: {
      id: { notIn: [...exclude] },
      OR: [
        ...(snowflake ? [{ discordId: snowflake }] : []),
        { name: { contains: q, mode: "insensitive" as const } },
      ],
    },
    select: SUGGEST_SELECT,
    take: opts.limit ?? 12,
    orderBy: { name: "asc" },
  });

  return matches.map((u) => ({
    ...u,
    reason: u.discordId ? ("on-discord" as const) : ("on-dawn" as const),
    reasonLabel: snowflake
      ? "Discord ID match"
      : u.discordId
        ? "On Discord · Dawn"
        : "On Dawn · Google or email",
  }));
}

export async function sharesDiscordServer(
  meId: string,
  otherId: string
): Promise<boolean> {
  const [mine, theirs] = await Promise.all([
    prisma.trackedMember.findMany({
      where: { userId: meId },
      include: { channel: { select: { guildId: true } } },
    }),
    prisma.trackedMember.findMany({
      where: { userId: otherId },
      include: { channel: { select: { guildId: true } } },
    }),
  ]);
  const envGuild = process.env.DISCORD_GUILD_ID?.trim();
  const myGuilds = new Set(
    [...mine.map((t) => t.channel.guildId), envGuild || ""].filter(Boolean)
  );
  return theirs.some((t) => myGuilds.has(t.channel.guildId));
}

/** Owner, or adding a Discord / same-server Dawn user. */
export async function canAddFriendToCircle(opts: {
  meId: string;
  targetId: string;
  isOwner: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  if (opts.meId === opts.targetId) {
    return { ok: false, error: "That’s you." };
  }
  const target = await prisma.user.findUnique({
    where: { id: opts.targetId },
    select: { id: true, discordId: true, name: true },
  });
  if (!target) return { ok: false, error: "Person not found on Dawn." };
  return { ok: true };
}
