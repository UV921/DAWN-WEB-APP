/**
 * Server-only: claim due study-care pings and send Discord + Web Push.
 * Keep this out of study-nudges.ts so the client bundle never loads web-push.
 */

import type { PrismaClient, StudyNudge, User } from "@prisma/client";
import { normChannelId } from "./bot-messages";
import { sendWebPushToUser, type WebPushSendResult } from "./web-push";
import { isStudyNudgeDue, normalizeDiscordTarget } from "./study-nudges";

export type StudyNudgeDiscordSender = {
  sendChannel: (
    channelId: string,
    title: string,
    body: string,
    mentionUserId?: string | null
  ) => Promise<{ ok: boolean; error?: string }>;
  sendDm: (
    discordUserId: string,
    title: string,
    body: string
  ) => Promise<{ ok: boolean; error?: string }>;
};

export type StudyNudgeFireResult = {
  nudgeId: string;
  title: string;
  message: string;
  notifyBrowser: boolean;
  discord: { channel?: boolean; dm?: boolean; error?: string };
  push?: WebPushSendResult;
};

async function resolveChannelId(
  prisma: PrismaClient,
  user: User
): Promise<string | null> {
  const fromUser = normChannelId(user.discordChannelId);
  if (fromUser) return fromUser;
  const membership = await prisma.circleMember.findFirst({
    where: { userId: user.id },
    include: { circle: true },
  });
  const fromCircle = normChannelId(membership?.circle.discordChannelId);
  if (fromCircle) return fromCircle;
  return normChannelId(process.env.DISCORD_CHANNEL_ID) || null;
}

async function resolveDiscordId(
  prisma: PrismaClient,
  user: User
): Promise<string | null> {
  if (user.discordId) return user.discordId;
  const account = await prisma.account.findFirst({
    where: { userId: user.id, provider: "discord" },
  });
  return account?.providerAccountId || null;
}

/** Claim + send Discord and Web Push care pings for live study sessions. */
export async function processDueStudyNudges(
  prisma: PrismaClient,
  opts: {
    userId?: string;
    discord: StudyNudgeDiscordSender;
    now?: Date;
  }
): Promise<{ due: StudyNudgeFireResult[]; now: string }> {
  const now = opts.now || new Date();
  const liveWhere = opts.userId
    ? { userId: opts.userId, endedAt: null }
    : { endedAt: null };

  const sessions = await prisma.studySession.findMany({
    where: liveWhere,
    orderBy: { startedAt: "desc" },
  });

  const latestByUser = new Map<string, (typeof sessions)[number]>();
  for (const session of sessions) {
    if (!latestByUser.has(session.userId)) {
      latestByUser.set(session.userId, session);
    }
  }

  const results: StudyNudgeFireResult[] = [];

  for (const [userId, session] of latestByUser) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) continue;

    const nudges = await prisma.studyNudge.findMany({
      where: {
        userId,
        enabled: true,
        OR: [{ notifyDiscord: true }, { notifyBrowser: true }],
      },
    });

    for (const nudge of nudges) {
      if (
        !isStudyNudgeDue({
          now,
          sessionStartedAt: session.startedAt,
          lastFiredAt: nudge.lastFiredAt,
          intervalMinutes: nudge.intervalMinutes,
        })
      ) {
        continue;
      }

      const claimed = await prisma.studyNudge.updateMany({
        where: {
          id: nudge.id,
          lastFiredAt: nudge.lastFiredAt,
        },
        data: { lastFiredAt: now },
      });
      if (claimed.count === 0) continue;

      const title = nudge.title || "Study care";
      const body =
        nudge.message || "Take a short break — water, blink, then back to it.";

      const result: StudyNudgeFireResult = {
        nudgeId: nudge.id,
        title,
        message: body,
        notifyBrowser: nudge.notifyBrowser,
        discord: {},
      };

      if (nudge.notifyBrowser) {
        result.push = await sendWebPushToUser(prisma, user.id, {
          title,
          body,
          url: "/dashboard",
          tag: `dawn-study-${nudge.id}`,
        });
      }
      if (nudge.notifyDiscord) {
        await deliverStudyNudgeDiscord(prisma, user, nudge, opts.discord, result);
      }
      results.push(result);
    }
  }

  return { due: results, now: now.toISOString() };
}

async function deliverStudyNudgeDiscord(
  prisma: PrismaClient,
  user: User,
  nudge: StudyNudge,
  discord: StudyNudgeDiscordSender,
  result: StudyNudgeFireResult
) {
  const target = normalizeDiscordTarget(
    nudge.discordTarget,
    user.discordNotifyDefault
  );
  const title = nudge.title || "Study care";
  const body =
    nudge.message || "Take a short break — water, blink, then back to it.";
  const discordId = await resolveDiscordId(prisma, user);

  if (target === "channel" || target === "both") {
    const channelId = await resolveChannelId(prisma, user);
    if (channelId) {
      const res = await discord.sendChannel(channelId, title, body, discordId);
      result.discord.channel = res.ok;
      if (!res.ok) result.discord.error = res.error;
    } else {
      result.discord.error = "No Discord channel set";
    }
  }

  if (target === "dm" || target === "both") {
    if (discordId) {
      const res = await discord.sendDm(discordId, title, body);
      result.discord.dm = res.ok;
      if (!res.ok) {
        result.discord.error = [result.discord.error, res.error]
          .filter(Boolean)
          .join("; ");
      }
    } else {
      result.discord.error = [
        result.discord.error,
        "No Discord account linked",
      ]
        .filter(Boolean)
        .join("; ");
    }
  }
}
