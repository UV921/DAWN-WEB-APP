/** Pull an invite code out of pasted text, a Dawn URL, or a messy code. */
export function parseInviteInput(raw: string): string {
  const t = String(raw || "").trim();
  if (!t) return "";
  try {
    const url = new URL(t);
    const join = url.searchParams.get("join");
    if (join) return sanitizeInviteCode(join);
  } catch {
    // not a full URL
  }
  const joinMatch = t.match(/[?&]join=([A-Za-z0-9]+)/i);
  if (joinMatch) return sanitizeInviteCode(joinMatch[1]);
  return sanitizeInviteCode(t);
}

export function sanitizeInviteCode(raw: string): string {
  return String(raw || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

export function discordFriendsInviteCode(guildId?: string | null): string | null {
  const id = String(guildId || process.env.DISCORD_GUILD_ID || "").trim();
  if (!id) return null;
  return `DS${id.replace(/\D/g, "").slice(-8).toUpperCase() || "FRIENDS"}`;
}

export function inviteLink(origin: string, code: string): string {
  const base = origin.replace(/\/$/, "") || "";
  return `${base}/circle?join=${encodeURIComponent(sanitizeInviteCode(code))}`;
}
