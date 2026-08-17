import type { PrismaClient } from "@prisma/client";
import {
  collectChannelIds,
  renderTemplate,
  type BotMessages,
} from "./bot-messages";
import { discordSendChannelMessage, type DiscordFile } from "./discord-notify";

export type TodoDiscordItem = {
  id?: string;
  text: string;
  done: boolean;
  parentId?: string | null;
  priority?: string | null;
  remindAt?: string | null;
};

export function formatTodoDiscordBody(todos: TodoDiscordItem[]): string {
  const byParent = new Map<string, TodoDiscordItem[]>();
  const ids = new Set(todos.map((t) => t.id).filter(Boolean) as string[]);
  for (const t of todos) {
    if (!t.parentId || !ids.has(t.parentId)) continue;
    const list = byParent.get(t.parentId) || [];
    list.push(t);
    byParent.set(t.parentId, list);
  }

  const lines: string[] = [];
  for (const t of todos.filter((x) => !x.parentId || !ids.has(x.parentId))) {
    const flag = t.priority === "high" ? " 🔴" : "";
    const at = t.remindAt ? ` · ${t.remindAt}` : "";
    lines.push(`${t.done ? "✅" : "⬜"} ${t.text}${flag}${at}`);
    for (const kid of byParent.get(t.id || "") || []) {
      lines.push(`　${kid.done ? "✅" : "⬜"} ${kid.text}`);
    }
  }

  const done = todos.filter((t) => t.done).length;
  lines.push("");
  lines.push(`**${done}/${todos.length} done**`);
  return lines.join("\n").slice(0, 3900);
}

export async function userTodoChannelIds(
  prisma: PrismaClient,
  userId: string,
  settings: BotMessages,
  discordChannelId?: string | null
): Promise<{ channelIds: string[]; hadConfiguredId: boolean }> {
  const tracked = await prisma.trackedMember.findMany({
    where: { userId },
    select: { channel: { select: { channelId: true } } },
  });
  const hadConfiguredId = Boolean(
    settings.todosChannelId ||
      discordChannelId ||
      process.env.DISCORD_CHANNEL_ID
  );
  return {
    hadConfiguredId,
    channelIds: collectChannelIds(
      settings.todosChannelId,
      discordChannelId,
      process.env.DISCORD_CHANNEL_ID,
      ...tracked.map((t) => t.channel.channelId)
    ),
  };
}

export function pngFileFromBase64(raw: unknown): DiscordFile | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  const b64 = s.replace(/^data:image\/png;base64,/i, "").replace(/\s/g, "");
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(Buffer.from(b64, "base64"));
  } catch {
    return null;
  }
  if (bytes.length < 24 || bytes.length > 7_500_000) return null;
  if (
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return null;
  }
  return {
    filename: "dawn-tasks.png",
    bytes,
    contentType: "image/png",
  };
}

export async function postTodosToDiscord(opts: {
  channelIds: string[];
  name: string;
  date: string;
  todos: (TodoDiscordItem & { id?: string })[];
  pingText?: string;
  mentionUserId?: string | null;
  image?: DiscordFile | null;
}): Promise<{ ok: boolean; error?: string }> {
  const title = `${opts.name || "Dawn"} · tasks for ${opts.date}`;
  const listBody = formatTodoDiscordBody(opts.todos);
  const ping = (opts.pingText || "").trim();
  const mention = opts.mentionUserId
    ? `<@${opts.mentionUserId}>`
    : "";
  const content = [mention, ping].filter(Boolean).join("\n").slice(0, 2000);
  const body = opts.image
    ? `**${opts.todos.filter((t) => t.done).length}/${opts.todos.length} done**`
    : listBody;

  let lastError = "Discord rejected the message.";
  for (const channelId of opts.channelIds) {
    const sent = await discordSendChannelMessage(channelId, {
      title,
      body,
      content: content || title,
      mentionUserId: opts.mentionUserId,
      files: opts.image ? [opts.image] : undefined,
    });
    if (sent.ok) return { ok: true };
    lastError = sent.error || lastError;
  }
  return { ok: false, error: lastError };
}

export function pingTextForUser(
  settings: BotMessages,
  vars: { name?: string; todos?: string; wake?: string; sleep?: string }
) {
  const raw =
    settings.todosPingText || "Here's today's list — you've got this.";
  return renderTemplate(raw, vars);
}
