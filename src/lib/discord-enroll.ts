import { prisma } from "@/lib/prisma";
import { normChannelId } from "@/lib/bot-messages";

/** Put a Discord-logged Dawn user on the server board + Discord friends circle. */
export async function enrollDiscordFriend(opts: {
  userId: string;
  discordId: string | null;
}) {
  const guildId = process.env.DISCORD_GUILD_ID?.trim() || "";
  const channelId = normChannelId(process.env.DISCORD_CHANNEL_ID);
  if (!opts.discordId) return;

  if (guildId && channelId) {
    const tracked = await prisma.trackedChannel.upsert({
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
          trackedChannelId: tracked.id,
          userId: opts.userId,
        },
      },
      create: { trackedChannelId: tracked.id, userId: opts.userId },
      update: {},
    });
  }

  if (!guildId) return;

  const inviteCode = `DS${guildId.replace(/\D/g, "").slice(-8).toUpperCase() || "FRIENDS"}`;
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
    return;
  }
  await prisma.circleMember.upsert({
    where: {
      circleId_userId: { circleId: circle.id, userId: opts.userId },
    },
    create: { circleId: circle.id, userId: opts.userId },
    update: {},
  });
}
