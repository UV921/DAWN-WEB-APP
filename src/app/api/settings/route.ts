import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseBotMessages,
  serializeBotMessages,
  normChannelId,
  type BotMessages,
} from "@/lib/bot-messages";

const DISCORD_MODES = new Set(["channel", "dm", "both", "off"]);

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      image: true,
      wakeGoal: true,
      sleepGoal: true,
      timezone: true,
      discordNotifyDefault: true,
      discordChannelId: true,
      discordId: true,
      identityLine: true,
      whyLine: true,
      pledgeText: true,
      focusHabitKey: true,
      onboardingDone: true,
      challengeStartDate: true,
      botMessagesJson: true,
    },
  });

  return NextResponse.json({
    user,
    botMessages: parseBotMessages(user?.botMessagesJson),
    hasDiscord: Boolean(user?.discordId),
  });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const data: {
    wakeGoal?: string;
    sleepGoal?: string;
    timezone?: string;
    name?: string;
    discordNotifyDefault?: string;
    discordChannelId?: string | null;
    onboardingDone?: boolean;
    identityLine?: string;
    whyLine?: string;
    pledgeText?: string;
    focusHabitKey?: string;
    botMessagesJson?: string;
  } = {};

  if (body.wakeGoal && /^\d{2}:\d{2}$/.test(body.wakeGoal)) {
    data.wakeGoal = body.wakeGoal;
  }
  if (body.sleepGoal && /^\d{2}:\d{2}$/.test(body.sleepGoal)) {
    data.sleepGoal = body.sleepGoal;
  }
  if (body.timezone && typeof body.timezone === "string") {
    data.timezone = body.timezone.slice(0, 64);
  }
  if (typeof body.name === "string") {
    data.name = body.name.trim().slice(0, 80) || undefined;
  }
  if (DISCORD_MODES.has(body.discordNotifyDefault)) {
    data.discordNotifyDefault = body.discordNotifyDefault;
  }
  if (body.discordChannelId !== undefined) {
    data.discordChannelId = body.discordChannelId
      ? normChannelId(body.discordChannelId) || null
      : null;
  }
  if (typeof body.onboardingDone === "boolean") {
    data.onboardingDone = body.onboardingDone;
  }
  if (typeof body.identityLine === "string") {
    data.identityLine = body.identityLine.trim().slice(0, 120);
  }
  if (typeof body.whyLine === "string") {
    data.whyLine = body.whyLine.trim().slice(0, 240);
  }
  if (typeof body.pledgeText === "string") {
    data.pledgeText = body.pledgeText.trim().slice(0, 200);
  }
  if (typeof body.focusHabitKey === "string") {
    data.focusHabitKey = body.focusHabitKey.trim().slice(0, 40);
  }
  if (body.botMessages && typeof body.botMessages === "object") {
    data.botMessagesJson = serializeBotMessages(
      body.botMessages as BotMessages
    );
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
  });

  if (data.wakeGoal) {
    await prisma.goal.updateMany({
      where: { userId: session.user.id, kind: "wake" },
      data: { targetTime: data.wakeGoal },
    });
  }
  if (data.sleepGoal) {
    await prisma.goal.updateMany({
      where: { userId: session.user.id, kind: "sleep" },
      data: { targetTime: data.sleepGoal },
    });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      wakeGoal: user.wakeGoal,
      sleepGoal: user.sleepGoal,
      timezone: user.timezone,
      discordNotifyDefault: user.discordNotifyDefault,
      discordChannelId: user.discordChannelId,
      identityLine: user.identityLine,
      whyLine: user.whyLine,
      pledgeText: user.pledgeText,
      focusHabitKey: user.focusHabitKey,
      discordId: user.discordId,
    },
    botMessages: parseBotMessages(user.botMessagesJson),
  });
}
