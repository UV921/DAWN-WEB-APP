/** Pure Discord REST helpers (usable from Next.js and the bot). */

import { normChannelId } from "./bot-messages";

function botToken() {
  return process.env.DISCORD_BOT_TOKEN?.trim() || "";
}

function missingBotTokenError() {
  return (
    "Dawn’s website is missing DISCORD_BOT_TOKEN. Add the same bot token to Vercel Production — " +
    "Send now does not use the Northflank bot process."
  );
}

/**
 * Invite permission integer:
 * View Channel, Send Messages, Embed Links, Attach Files, Read Message History,
 * Use Application Commands, Create Public Threads, Send Messages in Threads.
 *
 * Do not use bitwise `|` — JS shifts are 32-bit signed, and thread perms sit
 * above bit 31. The sum stays inside Number.MAX_SAFE_INTEGER.
 */
export const DISCORD_BOT_INVITE_PERMISSIONS = String(
  1024 + // VIEW_CHANNEL
    2048 + // SEND_MESSAGES
    16384 + // EMBED_LINKS
    32768 + // ATTACH_FILES
    65536 + // READ_MESSAGE_HISTORY
    2147483648 + // USE_APPLICATION_COMMANDS
    34359738368 + // CREATE_PUBLIC_THREADS
    274877906944 // SEND_MESSAGES_IN_THREADS
);

const TEXTISH_TYPES = new Set([0, 1, 2, 3, 5, 10, 11, 12]);
const FORUM_TYPES = new Set([15, 16]);

type DiscordApiError = { message?: string; code?: number };
type DiscordChannel = { id: string; type: number; name?: string; guild_id?: string };

export function formatDiscordApiError(raw: string): string {
  let parsed: DiscordApiError | null = null;
  try {
    parsed = JSON.parse(raw) as DiscordApiError;
  } catch {
    parsed = null;
  }
  const code = parsed?.code;
  const msg = (parsed?.message || raw || "Discord rejected the message.").trim();

  if (code === 50001 || /missing access/i.test(raw)) {
    return (
      "Could not post to Discord: missing access (50001). Dawn’s bot cannot see that channel. " +
      "Re-invite the bot from Settings → Discord, then give it View Channel, Send Messages, " +
      "and Embed Links on the channel (including private ones). Paste a Channel ID " +
      "(right-click → Copy Channel ID) or a discord.com/channels/… link — not the Server ID."
    );
  }
  if (code === 50013) {
    return (
      "Could not post to Discord: missing permissions (50013). The bot can see the channel " +
      "but needs Send Messages and Embed Links. Edit the channel permissions or re-invite " +
      "the bot from Settings → Discord."
    );
  }
  if (code === 10003) {
    return (
      "Could not post to Discord: unknown channel (10003). That ID is not a text channel " +
      "the bot can find. Copy the Channel ID again (Developer Mode → right-click the channel)."
    );
  }
  if (code === 50024) {
    return (
      "Could not post to Discord: that isn’t a text channel (50024). Use a text or announcement " +
      "channel, not a category, forum index, or voice-only channel."
    );
  }
  if (code) return `Could not post to Discord: ${msg} (${code}).`;
  return raw.length > 280 ? `${msg.slice(0, 280)}…` : msg || "Discord rejected the message.";
}

export type DiscordFile = {
  filename: string;
  bytes: Uint8Array;
  contentType?: string;
};

export type DiscordSendOpts = {
  title: string;
  body: string;
  color?: number;
  /** Overrides the default title-as-content line. */
  content?: string;
  mentionUserId?: string | null;
  files?: DiscordFile[];
};

async function discordFetch(path: string, init?: RequestInit) {
  const token = botToken();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bot ${token}`);
  const isForm = typeof FormData !== "undefined" && init?.body instanceof FormData;
  if (!isForm && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`https://discord.com/api/v10${path}`, { ...init, headers });
}

function mentionLine(id?: string | null) {
  return id && /^\d{17,20}$/.test(id) ? `<@${id}>` : "";
}

function allowedMentions(id?: string | null) {
  return id && /^\d{17,20}$/.test(id)
    ? { parse: [] as string[], users: [id] }
    : { parse: [] as string[] };
}

function embedPayload(
  opts: DiscordSendOpts,
  file?: DiscordFile
): Record<string, unknown> {
  const embed: Record<string, unknown> = {
    title: opts.title.slice(0, 256),
    description: (file ? opts.body.slice(0, 800) : opts.body).slice(0, 4096),
    color: opts.color ?? 0xf0b45a,
    footer: { text: "Dawn reminder" },
    timestamp: new Date().toISOString(),
  };
  if (file) {
    embed.image = { url: `attachment://${file.filename}` };
  }
  return embed;
}

async function postToChannel(
  channelId: string,
  opts: DiscordSendOpts,
  asForumPost: boolean
): Promise<{ ok: boolean; error?: string; status?: number; raw?: string }> {
  const files = opts.files?.slice(0, 1) || [];
  const file = files[0];
  const ping = mentionLine(opts.mentionUserId);
  const content = (
    opts.content ||
    [ping, opts.title].filter(Boolean).join("\n")
  ).slice(0, 2000);
  const embed = embedPayload(opts, file);
  const attachments = files.map((f, i) => ({ id: i, filename: f.filename }));
  const message: Record<string, unknown> = {
    content,
    allowed_mentions: allowedMentions(opts.mentionUserId),
  };
  if (attachments.length) message.attachments = attachments;

  const attempts: { embeds: boolean }[] = [{ embeds: true }, { embeds: false }];
  let lastRaw = "";
  let lastStatus = 0;

  for (const attempt of attempts) {
    const payload = attempt.embeds
      ? { ...message, embeds: [embed] }
      : {
          content: [content, opts.body].filter(Boolean).join("\n").slice(0, 2000),
          allowed_mentions: allowedMentions(opts.mentionUserId),
          ...(attachments.length ? { attachments } : {}),
        };

    const wrapped = asForumPost
      ? {
          name: opts.title.slice(0, 100) || "Dawn tasks",
          auto_archive_duration: 1440,
          message: payload,
        }
      : payload;

    let body: BodyInit = JSON.stringify(wrapped);
    const headers: HeadersInit = {};
    if (file) {
      try {
        const form = new FormData();
        form.append("payload_json", JSON.stringify(wrapped));
        const copy = new ArrayBuffer(file.bytes.byteLength);
        new Uint8Array(copy).set(file.bytes);
        form.append(
          "files[0]",
          new Blob([copy], { type: file.contentType || "image/png" }),
          file.filename
        );
        body = form;
      } catch {
        body = JSON.stringify(
          asForumPost
            ? {
                name: opts.title.slice(0, 100) || "Dawn tasks",
                auto_archive_duration: 1440,
                message: {
                  content: [content, opts.body].filter(Boolean).join("\n").slice(0, 2000),
                  allowed_mentions: allowedMentions(opts.mentionUserId),
                  embeds: attempt.embeds ? [embedPayload(opts)] : undefined,
                },
              }
            : {
                content: [content, opts.body].filter(Boolean).join("\n").slice(0, 2000),
                allowed_mentions: allowedMentions(opts.mentionUserId),
                embeds: attempt.embeds ? [embedPayload(opts)] : undefined,
              }
        );
      }
    }

    const res = await discordFetch(
      asForumPost
        ? `/channels/${channelId}/threads`
        : `/channels/${channelId}/messages`,
      { method: "POST", headers, body }
    );

    if (res.ok) return { ok: true };
    lastRaw = await res.text();
    lastStatus = res.status;
    let code: number | undefined;
    try {
      code = (JSON.parse(lastRaw) as DiscordApiError).code;
    } catch {
      code = undefined;
    }
    if (attempt.embeds && code === 50013) continue;
    break;
  }

  return {
    ok: false,
    error: formatDiscordApiError(lastRaw),
    status: lastStatus,
    raw: lastRaw,
  };
}

export async function discordSendChannelMessage(
  channelId: string,
  opts: DiscordSendOpts
): Promise<{ ok: boolean; error?: string }> {
  const token = botToken();
  if (!token) return { ok: false, error: missingBotTokenError() };
  const id = normChannelId(channelId);
  if (!id) {
    return {
      ok: false,
      error:
        "That Discord channel ID looks invalid. Paste a Channel ID or a discord.com/channels/… link, not the Server ID.",
    };
  }

  try {
    // Happy path: one Discord POST. A GET first often pushed Vercel past
    // the 10s Hobby limit, which the phone then showed as “couldn’t reach Dawn.”
    const posted = await postToChannel(id, opts, false);
    if (posted.ok) return { ok: true };

    let code: number | undefined;
    try {
      code = (JSON.parse(posted.raw || "") as DiscordApiError).code;
    } catch {
      code = undefined;
    }
    if (code === 50001 || code === 50013 || code === 10003) {
      return { ok: false, error: posted.error };
    }

    const chRes = await discordFetch(`/channels/${id}`);
    if (!chRes.ok) {
      const raw = await chRes.text();
      return { ok: false, error: formatDiscordApiError(raw) || posted.error };
    }
    const channel = (await chRes.json()) as DiscordChannel;
    if (channel.type === 4) {
      return {
        ok: false,
        error:
          "That ID is a category, not a channel. Right-click the text channel itself and Copy Channel ID.",
      };
    }
    if (FORUM_TYPES.has(channel.type)) {
      return postToChannel(id, opts, true);
    }
    if (!TEXTISH_TYPES.has(channel.type)) {
      return {
        ok: false,
        error:
          "Dawn can only post in a text, announcement, thread, or forum channel — not this channel type.",
      };
    }
    return { ok: false, error: posted.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/** Open (or reuse) a DM channel with a Discord user, then send. */
export async function discordSendDm(
  discordUserId: string,
  opts: DiscordSendOpts
): Promise<{ ok: boolean; error?: string }> {
  const token = botToken();
  if (!token) return { ok: false, error: missingBotTokenError() };
  if (!discordUserId) return { ok: false, error: "No Discord user id" };

  try {
    const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: discordUserId }),
    });
    if (!dmRes.ok) {
      const text = await dmRes.text();
      return {
        ok: false,
        error:
          "Could not open DM (user may need to share a server with the bot, or allow DMs). " +
          formatDiscordApiError(text),
      };
    }
    const dm = (await dmRes.json()) as { id: string };
    return discordSendChannelMessage(dm.id, opts);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export function reminderDiscordSender() {
  return {
    sendChannel: (channelId: string, title: string, body: string) =>
      discordSendChannelMessage(channelId, { title, body }),
    sendDm: (discordUserId: string, title: string, body: string) =>
      discordSendDm(discordUserId, { title, body }),
  };
}

/** Study care pings mention you in the channel so they land while you’re in VC. */
export function studyNudgeDiscordSender() {
  return {
    sendChannel: (
      channelId: string,
      title: string,
      body: string,
      mentionUserId?: string | null
    ) =>
      discordSendChannelMessage(channelId, {
        title,
        body,
        mentionUserId,
      }),
    sendDm: (discordUserId: string, title: string, body: string) =>
      discordSendDm(discordUserId, { title, body }),
  };
}
