/** Pure Discord REST helpers (usable from Next.js and the bot). */

function botToken() {
  return process.env.DISCORD_BOT_TOKEN?.trim() || "";
}

export async function discordSendChannelMessage(
  channelId: string,
  opts: { title: string; body: string; color?: number }
): Promise<{ ok: boolean; error?: string }> {
  const token = botToken();
  if (!token) return { ok: false, error: "DISCORD_BOT_TOKEN not set" };
  if (!channelId) return { ok: false, error: "No channel id" };

  try {
    const res = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          embeds: [
            {
              title: opts.title,
              description: opts.body,
              color: opts.color ?? 0xf0b45a,
              footer: { text: "Dawn reminder" },
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      }
    );
    if (!res.ok) return { ok: false, error: await res.text() };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/** Open (or reuse) a DM channel with a Discord user, then send. */
export async function discordSendDm(
  discordUserId: string,
  opts: { title: string; body: string; color?: number }
): Promise<{ ok: boolean; error?: string }> {
  const token = botToken();
  if (!token) return { ok: false, error: "DISCORD_BOT_TOKEN not set" };
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
          text,
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
