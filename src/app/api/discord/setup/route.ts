import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normChannelId } from "@/lib/bot-messages";
import {
  DISCORD_BOT_INVITE_PERMISSIONS,
  discordSendChannelMessage,
  discordSendDm,
} from "@/lib/discord-notify";

function botInviteUrl(clientId: string) {
  return `https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(
    clientId
  )}&permissions=${DISCORD_BOT_INVITE_PERMISSIONS}&scope=bot%20applications.commands`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      discordId: true,
      discordNotifyDefault: true,
      discordChannelId: true,
      name: true,
    },
  });

  const clientId = process.env.DISCORD_CLIENT_ID?.trim() || "";
  const botToken = Boolean(process.env.DISCORD_BOT_TOKEN?.trim());
  const guildId = process.env.DISCORD_GUILD_ID?.trim() || "";
  const defaultChannelId = process.env.DISCORD_CHANNEL_ID?.trim() || "";
  const oauthReady = Boolean(
    clientId && process.env.DISCORD_CLIENT_SECRET?.trim()
  );

  const steps = {
    oauthReady,
    botToken,
    loggedInWithDiscord: Boolean(user?.discordId),
    notifyMode: user?.discordNotifyDefault || "channel",
    hasChannel: Boolean(user?.discordChannelId || defaultChannelId),
    botRunningHint:
      "Keep `npm run bot` running in a terminal for morning pings & slash commands.",
  };

  return NextResponse.json({
    user: {
      discordId: user?.discordId,
      discordNotifyDefault: user?.discordNotifyDefault,
      discordChannelId: user?.discordChannelId,
      name: user?.name,
    },
    config: {
      clientId: clientId || null,
      guildId: guildId || null,
      defaultChannelId: defaultChannelId || null,
      inviteUrl: clientId ? botInviteUrl(clientId) : null,
      oauthReady,
      botConfigured: botToken,
    },
    steps,
    checklist: [
      {
        id: "oauth",
        done: oauthReady,
        title: "Discord login enabled on Dawn",
        detail: oauthReady
          ? "OAuth keys are configured."
          : "Admin needs DISCORD_CLIENT_ID + SECRET in .env",
      },
      {
        id: "bot",
        done: botToken,
        title: "Dawn bot token set",
        detail: botToken
          ? "Bot can send DMs and channel messages."
          : "Admin needs DISCORD_BOT_TOKEN in .env",
      },
      {
        id: "login",
        done: Boolean(user?.discordId),
        title: "You signed in with Discord",
        detail: user?.discordId
          ? `Linked Discord id · ${user.discordId}`
          : "Use Sign out → Login → Continue with Discord",
      },
      {
        id: "invite",
        done: Boolean(guildId),
        title: "Bot invited to your server",
        detail: guildId
          ? `Server ID configured (${guildId}). Confirm the bot is in that server.`
          : "Invite the bot, then set DISCORD_GUILD_ID (admin) or use channel ID below.",
      },
      {
        id: "channel",
        done: Boolean(user?.discordChannelId || defaultChannelId),
        title: "Progress channel chosen",
        detail:
          "Paste a Channel ID or discord.com/channels/… link so Dawn knows where to post.",
      },
      {
        id: "notify",
        done: (user?.discordNotifyDefault || "off") !== "off",
        title: "Notifications turned on",
        detail: "Pick Channel, DM me, or Both.",
      },
    ],
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "test");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      discordId: true,
      discordChannelId: true,
      name: true,
      discordNotifyDefault: true,
    },
  });

  if (action === "test-dm") {
    if (!user?.discordId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Sign in with Discord first (Sign out → Login → Continue with Discord).",
        },
        { status: 400 }
      );
    }
    const res = await discordSendDm(user.discordId, {
      title: "Dawn · test DM",
      body: `Hey ${user.name || "there"} — Discord DMs work. Morning pings can reach you here.`,
    });
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }

  if (action === "test-channel") {
    const channelId =
      normChannelId(body.channelId) ||
      normChannelId(user?.discordChannelId) ||
      normChannelId(process.env.DISCORD_CHANNEL_ID) ||
      "";
    if (!channelId) {
      return NextResponse.json(
        { ok: false, error: "Add a channel ID first." },
        { status: 400 }
      );
    }
    const res = await discordSendChannelMessage(channelId, {
      title: "Dawn · test channel",
      body: `${user?.name || "Someone"} tested channel pings from Settings.`,
    });
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
