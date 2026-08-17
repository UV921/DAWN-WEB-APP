import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateInZone } from "@/lib/clock";
import { parseBotMessages } from "@/lib/bot-messages";
import {
  discordImageFromBytes,
  pingTextForUser,
  pngFileFromBase64,
  postTodosToDiscord,
  userTodoChannelIds,
} from "@/lib/todo-discord";
import type { DiscordFile } from "@/lib/discord-notify";

export const runtime = "nodejs";
export const maxDuration = 30;

async function readSendPayload(req: Request): Promise<{
  dateRaw: string;
  pingText: string;
  image: DiscordFile | null;
}> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    const dateRaw = String(form?.get("date") || "");
    const pingText = String(form?.get("message") || "").trim().slice(0, 300);
    const file = form?.get("image");
    let image: DiscordFile | null = null;
    if (file instanceof Blob && file.size > 24) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      image = discordImageFromBytes(bytes);
    }
    return { dateRaw, pingText, image };
  }

  const body = (await req.json().catch(() => ({}))) as {
    date?: unknown;
    message?: unknown;
    image?: unknown;
  };
  return {
    dateRaw: typeof body.date === "string" ? body.date : "",
    pingText:
      typeof body.message === "string" ? body.message.trim().slice(0, 300) : "",
    image: pngFileFromBase64(body.image),
  };
}

/** Post the day's task list (and the same card as Download PNG) into Discord. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { dateRaw, pingText, image } = await readSendPayload(req);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
    ? dateRaw
    : formatDateInZone(session.user.timezone);

  const [user, todos] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        discordChannelId: true,
        botMessagesJson: true,
        discordId: true,
        wakeGoal: true,
        sleepGoal: true,
      },
    }),
    prisma.todo.findMany({
      where: { userId: session.user.id, date },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const settings = parseBotMessages(user?.botMessagesJson);
  const { channelIds, hadConfiguredId } = await userTodoChannelIds(
    prisma,
    session.user.id,
    settings,
    user?.discordChannelId
  );
  if (channelIds.length === 0) {
    return NextResponse.json(
      {
        error: hadConfiguredId
          ? "That Discord channel ID looks invalid (a server link may have been pasted). In Settings → Discord, paste a Channel ID or a discord.com/channels/… link — not the Server ID."
          : "No channel set. Add a Channel ID (or paste a discord.com/channels/… link) in Settings → Discord.",
      },
      { status: 400 }
    );
  }
  if (todos.length === 0) {
    return NextResponse.json({ error: "No tasks to send." }, { status: 400 });
  }

  const sent = await postTodosToDiscord({
    channelIds,
    name: user?.name || "Dawn",
    date,
    todos,
    pingText:
      pingText ||
      pingTextForUser(settings, {
        name: user?.name || "there",
        wake: user?.wakeGoal,
        sleep: user?.sleepGoal,
      }),
    mentionUserId: user?.discordId,
    image,
  });

  if (!sent.ok) {
    return NextResponse.json(
      { error: sent.error || "Discord rejected the message." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    count: todos.length,
    usedImage: Boolean(sent.usedImage),
  });
}
