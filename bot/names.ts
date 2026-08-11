/**
 * Resolve Discord display names (never show raw IDs).
 * Syncs the friendly name back onto User.name in the DB.
 */

import type { Client } from "discord.js";
import type { PrismaClient, User } from "@prisma/client";

const nameCache = new Map<string, { name: string; at: number }>();
const TTL = 10 * 60 * 1000;

export function fallbackName(user: Pick<User, "name" | "email" | "discordId">): string {
  if (user.name && !user.name.match(/^\d{17,20}$/)) return user.name;
  if (user.email?.includes("@users.noreply.discord.local")) return "Member";
  return user.name || "Member";
}

export async function resolveDisplayName(
  client: Client,
  prisma: PrismaClient,
  user: User
): Promise<string> {
  if (!user.discordId) return fallbackName(user);

  const cached = nameCache.get(user.discordId);
  if (cached && Date.now() - cached.at < TTL) return cached.name;

  try {
    const du = await client.users.fetch(user.discordId);
    const name =
      // discord.js v14+: displayName, globalName, username
      (du as { displayName?: string }).displayName ||
      (du as { globalName?: string | null }).globalName ||
      du.username ||
      fallbackName(user);

    nameCache.set(user.discordId, { name, at: Date.now() });

    if (name && name !== user.name) {
      await prisma.user.update({
        where: { id: user.id },
        data: { name },
      });
    }
    return name;
  } catch {
    return fallbackName(user);
  }
}

export async function resolveManyNames(
  client: Client,
  prisma: PrismaClient,
  users: User[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  await Promise.all(
    users.map(async (u) => {
      map.set(u.id, await resolveDisplayName(client, prisma, u));
    })
  );
  return map;
}
