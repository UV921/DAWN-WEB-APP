import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateInZone } from "@/lib/clock";
import { discordSendChannelMessage } from "@/lib/discord-notify";
import { parseBotMessages, resolveChannelId } from "@/lib/bot-messages";

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

  const [user, todos] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, discordChannelId: true, botMessagesJson: true },
    }),
    prisma.todo.findMany({
      where: { userId: session.user.id, date },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const settings = parseBotMessages(user?.botMessagesJson);
  const channelId = resolveChannelId(
    settings.todosChannelId,
    user?.discordChannelId
  );
  if (!channelId) {
    return NextResponse.json(
      { error: "No channel set. Add a channel ID in Settings → Discord." },
      { status: 400 }
    );
  }
  if (todos.length === 0) {
    return NextResponse.json({ error: "No tasks to send." }, { status: 400 });
  }

  const byParent = new Map<string, typeof todos>();
  for (const t of todos) {
    if (!t.parentId) continue;
    const list = byParent.get(t.parentId) || [];
    list.push(t);
    byParent.set(t.parentId, list);
  }

  const lines: string[] = [];
  for (const t of todos.filter((x) => !x.parentId)) {
    const flag = t.priority === "high" ? " 🔴" : "";
    const at = t.remindAt ? ` · ${t.remindAt}` : "";
    lines.push(`${t.done ? "✅" : "⬜"} ${t.text}${flag}${at}`);
    for (const kid of byParent.get(t.id) || []) {
      lines.push(`　${kid.done ? "✅" : "⬜"} ${kid.text}`);
    }
  }

  const done = todos.filter((t) => t.done).length;
  lines.push("");
  lines.push(`**${done}/${todos.length} done**`);

  const sent = await discordSendChannelMessage(channelId, {
    title: `${user?.name || "Dawn"} · tasks for ${date}`,
    body: lines.join("\n").slice(0, 3900),
  });

  if (!sent.ok) {
    return NextResponse.json(
      { error: sent.error || "Discord rejected the message." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, count: todos.length });
}
