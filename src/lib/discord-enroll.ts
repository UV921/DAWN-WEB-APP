import { prisma } from "@/lib/prisma";
import { discordFriendsInviteCode } from "@/lib/circle-invite";
import { normChannelId } from "@/lib/bot-messages";

/** Put a Discord-logged Dawn user on the server board + Discord friends circle. */
export async function enrollDiscordFriend(opts: {
  userId: string;
  discordId: string | null;
}): Promise<{ circleId: string | null; tracked: boolean }> {
  const guildId = process.env.DISCORD_GUILD_ID?.trim() || "";
  const channelId = normChannelId(process.env.DISCORD_CHANNEL_ID);
  if (!opts.discordId) return { circleId: null, tracked: false };

  let tracked = false;
  if (guildId && channelId) {
    const board = await prisma.trackedChannel.upsert({
      where: { channelId },
      create: {
        channelId,
        guildId,
        name: "Dawn Discord",
      },
      update: {},
    });
    await prisma.trackedMember.upsert({
      where: {
        trackedChannelId_userId: {
          trackedChannelId: board.id,
          userId: opts.userId,
        },
      },
      create: { trackedChannelId: board.id, userId: opts.userId },
      update: {},
    });
    tracked = true;
  }

  const inviteCode = discordFriendsInviteCode(guildId);
  if (!inviteCode) return { circleId: null, tracked };

  let circle = await prisma.accountabilityCircle.findUnique({
    where: { inviteCode },
  });
  if (!circle) {
    circle = await prisma.accountabilityCircle.create({
      data: {
        name: "Discord friends",
        inviteCode,
        ownerId: opts.userId,
        discordChannelId: channelId || null,
        members: { create: { userId: opts.userId } },
      },
    });
    return { circleId: circle.id, tracked };
  }
  await prisma.circleMember.upsert({
    where: {
      circleId_userId: { circleId: circle.id, userId: opts.userId },
    },
    create: { circleId: circle.id, userId: opts.userId },
    update: {},
  });
  return { circleId: circle.id, tracked };
}
