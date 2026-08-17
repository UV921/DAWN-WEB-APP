import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateInZone } from "@/lib/clock";
import { parseBotMessages } from "@/lib/bot-messages";
import {
  pingTextForUser,
  pngFileFromBase64,
  postTodosToDiscord,
  userTodoChannelIds,
} from "@/lib/todo-discord";

export const maxDuration = 30;

/** Post the day's task list into the user's Discord channel. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const date =
    typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : formatDateInZone(session.user.timezone);
  const pingText =
    typeof body.message === "string" ? body.message.trim().slice(0, 300) : "";
  const image = pngFileFromBase64(body.image);

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

  return NextResponse.json({ ok: true, count: todos.length });
}
