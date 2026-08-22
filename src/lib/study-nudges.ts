/**
 * Interval care pings while a study session is live.
 *
 * Discord is sent by the bot (and /api/reminders/tick) so it still fires
 * when Dawn is closed. Browser alerts are shown by StudyCareWatcher from
 * the same interval clock — the tab can be in the background.
 */

import type { PrismaClient, StudyNudge, User } from "@prisma/client";
import { normChannelId } from "./bot-messages";

export const MIN_STUDY_NUDGE_MINUTES = 1;
export const MAX_STUDY_NUDGE_MINUTES = 12 * 60;
export const MAX_STUDY_NUDGES = 8;

export const STUDY_NUDGE_PRESETS = [
  {
    key: "water",
    title: "Drink water",
    message: "Take a sip. Keep the session going.",
    intervalMinutes: 20,
  },
  {
    key: "eyes",
    title: "Rest your eyes",
    message: "Blink and look 20 feet away for 20 seconds.",
    intervalMinutes: 20,
  },
  {
    key: "stretch",
    title: "Stretch",
    message: "Roll your shoulders. Unclench your jaw. Sit tall.",
    intervalMinutes: 45,
  },
] as const;

export type StudyNudgePresetKey = (typeof STUDY_NUDGE_PRESETS)[number]["key"];

export type StudyNudgeRow = {
  id: string;
  title: string;
  message: string;
  intervalMinutes: number;
  enabled: boolean;
  notifyBrowser: boolean;
  notifyDiscord: boolean;
  discordTarget: string;
  presetKey: string | null;
};

const PRESET_KEYS = new Set<string>(STUDY_NUDGE_PRESETS.map((p) => p.key));
const TARGETS = new Set(["channel", "dm", "both"]);

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
};

export function isStudyNudgePresetKey(raw: unknown): raw is StudyNudgePresetKey {
  return PRESET_KEYS.has(String(raw || ""));
}

export function clampStudyNudgeMinutes(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 20;
  return Math.min(
    MAX_STUDY_NUDGE_MINUTES,
    Math.max(MIN_STUDY_NUDGE_MINUTES, Math.round(n))
  );
}

/** Parse "20" + "min" or "1" + "hr" into stored minutes. */
export function minutesFromIntervalInput(
  amount: unknown,
  unit: unknown
): number {
  const n = typeof amount === "number" ? amount : Number(amount);
  const u = String(unit || "min").toLowerCase();
  const minutes = u === "hr" || u === "hour" || u === "hours" ? n * 60 : n;
  return clampStudyNudgeMinutes(minutes);
}

export function intervalInputFromMinutes(minutes: number): {
  amount: number;
  unit: "min" | "hr";
} {
  const n = clampStudyNudgeMinutes(minutes);
  if (n >= 60 && n % 60 === 0) return { amount: n / 60, unit: "hr" };
  return { amount: n, unit: "min" };
}

export function formatStudyNudgeInterval(minutes: number): string {
  const n = clampStudyNudgeMinutes(minutes);
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function normalizeDiscordTarget(
  raw: unknown,
  fallback = "channel"
): "channel" | "dm" | "both" {
  const s = String(raw || "").toLowerCase();
  if (TARGETS.has(s)) return s as "channel" | "dm" | "both";
  if (TARGETS.has(fallback)) return fallback as "channel" | "dm" | "both";
  return "channel";
}

/**
 * Next fire instant: interval after session start, then after each Discord fire
 * that happened during this session. A fire from an older session is ignored.
 */
export function studyNudgeDueAt(
  sessionStartedAt: Date,
  lastFiredAt: Date | null | undefined,
  intervalMinutes: number
): Date {
  const intervalMs = clampStudyNudgeMinutes(intervalMinutes) * 60_000;
  const started = sessionStartedAt.getTime();
  const last = lastFiredAt ? lastFiredAt.getTime() : NaN;
  const anchor = Number.isFinite(last) && last >= started ? last : started;
  return new Date(anchor + intervalMs);
}

export function isStudyNudgeDue(opts: {
  now: Date;
  sessionStartedAt: Date;
  lastFiredAt?: Date | null;
  intervalMinutes: number;
}): boolean {
  return (
    opts.now.getTime() >=
    studyNudgeDueAt(
      opts.sessionStartedAt,
      opts.lastFiredAt,
      opts.intervalMinutes
    ).getTime()
  );
}

/** 1-based slot since session start — used to de-dupe browser alerts. */
export function studyNudgeBrowserSlot(
  sessionStartedAt: Date,
  now: Date,
  intervalMinutes: number
): number {
  const intervalMs = clampStudyNudgeMinutes(intervalMinutes) * 60_000;
  const elapsed = now.getTime() - sessionStartedAt.getTime();
  if (elapsed < intervalMs) return 0;
  return Math.floor(elapsed / intervalMs);
}

export function studyNudgePresetByKey(key: string) {
  return STUDY_NUDGE_PRESETS.find((p) => p.key === key) || null;
}

async function resolveChannelId(
  prisma: PrismaClient,
  user: User,
  override?: string | null
): Promise<string | null> {
  const fromOverride = normChannelId(override);
  if (fromOverride) return fromOverride;
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

/** Claim + send Discord care pings that are due for live study sessions. */
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
      where: { userId, enabled: true, notifyDiscord: true },
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

      const result: StudyNudgeFireResult = {
        nudgeId: nudge.id,
        title: nudge.title,
        message: nudge.message,
        notifyBrowser: nudge.notifyBrowser,
        discord: {},
      };

      await deliverStudyNudgeDiscord(prisma, user, nudge, opts.discord, result);
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
      const res = await discord.sendChannel(
        channelId,
        title,
        body,
        discordId
      );
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
