import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { enrollDiscordFriend } from "@/lib/discord-enroll";

const discordConfigured =
  Boolean(process.env.DISCORD_CLIENT_ID?.trim()) &&
  Boolean(process.env.DISCORD_CLIENT_SECRET?.trim());

async function ensureDemoUser(email: string, name: string) {
  return prisma.user.upsert({
    where: { email },
    create: { email, name },
    update: { name },
  });
}

/** Avoid email unique collisions when linking Discord. */
async function uniqueEmailOrKeep(
  nextEmail: string,
  userId: string,
  currentEmail: string | null
) {
  const taken = await prisma.user.findUnique({
    where: { email: nextEmail },
    select: { id: true },
  });
  if (!taken || taken.id === userId) return nextEmail;
  return currentEmail ?? nextEmail;
}

function isSnowflake(id: string | undefined | null): id is string {
  return Boolean(id && /^\d{16,22}$/.test(id));
}

function isUniqueConflict(e: unknown) {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}

const sessionUserSelect = {
  id: true,
  discordId: true,
  wakeGoal: true,
  sleepGoal: true,
  timezone: true,
  name: true,
  image: true,
  email: true,
  onboardingDone: true,
  focusHabitKey: true,
  identityLine: true,
  whyLine: true,
  xp: true,
  level: true,
} as const;

/** Same Discord person → same Dawn row (web, bot, or leftover snowflake JWT). */
async function findUserByDiscord(discordId: string) {
  return prisma.user.findFirst({
    where: {
      OR: [
        { discordId },
        {
          accounts: {
            some: { provider: "discord", providerAccountId: discordId },
          },
        },
      ],
    },
    select: sessionUserSelect,
  });
}

async function resolveSessionUser(token: {
  sub?: string;
  discordId?: unknown;
}) {
  const discordId =
    typeof token.discordId === "string"
      ? token.discordId
      : isSnowflake(token.sub)
        ? token.sub
        : null;

  if (token.sub && !isSnowflake(token.sub)) {
    const byId = await prisma.user.findUnique({
      where: { id: token.sub },
      select: sessionUserSelect,
    });
    if (byId) return byId;
  }

  if (discordId) {
    const byDiscord = await findUserByDiscord(discordId);
    if (byDiscord) return byDiscord;
  }

  return null;
}

type DiscordProfileBits = {
  discordId: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

/**
 * Find or create the Dawn user for a Discord account.
 * NextAuth JWT (no adapter) discards `user.id` mutations from `signIn`, so
 * jwt must be able to create/find the same row on the first callback.
 */
async function ensureDiscordUser(bits: DiscordProfileBits) {
  const { discordId, name, image } = bits;
  const fallbackEmail = `${discordId}@users.noreply.discord.local`;
  const email = bits.email || fallbackEmail;

  const existing = await findUserByDiscord(discordId);
  if (existing) {
    const nextEmail =
      bits.email && bits.email !== existing.email
        ? await uniqueEmailOrKeep(bits.email, existing.id, existing.email)
        : undefined;
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        name: name ?? existing.name,
        image: image ?? existing.image,
        discordId,
        ...(nextEmail && nextEmail !== existing.email
          ? { email: nextEmail }
          : {}),
      },
      select: sessionUserSelect,
    });
  }

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    if (byEmail.discordId && byEmail.discordId !== discordId) {
      return createDiscordUser({
        discordId,
        email: fallbackEmail,
        name,
        image,
      });
    }
    return prisma.user.update({
      where: { id: byEmail.id },
      data: {
        name: name ?? byEmail.name,
        image: image ?? byEmail.image,
        discordId,
      },
      select: sessionUserSelect,
    });
  }

  return createDiscordUser({ discordId, email, name, image });
}

async function createDiscordUser(bits: {
  discordId: string;
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  try {
    return await prisma.user.create({
      data: {
        email: bits.email,
        name: bits.name,
        image: bits.image,
        discordId: bits.discordId,
      },
      select: sessionUserSelect,
    });
  } catch (e) {
    if (!isUniqueConflict(e)) throw e;
    const raced = await findUserByDiscord(bits.discordId);
    if (raced) return raced;
    const byEmail = await prisma.user.findUnique({
      where: { email: bits.email },
    });
    if (
      byEmail &&
      (!byEmail.discordId || byEmail.discordId === bits.discordId)
    ) {
      return prisma.user.update({
        where: { id: byEmail.id },
        data: {
          discordId: bits.discordId,
          name: bits.name ?? byEmail.name,
          image: bits.image ?? byEmail.image,
        },
        select: sessionUserSelect,
      });
    }
    const noreply = `${bits.discordId}@users.noreply.discord.local`;
    if (bits.email !== noreply) {
      try {
        return await prisma.user.create({
          data: {
            email: noreply,
            name: bits.name,
            image: bits.image,
            discordId: bits.discordId,
          },
          select: sessionUserSelect,
        });
      } catch (e2) {
        if (!isUniqueConflict(e2)) throw e2;
        const again = await findUserByDiscord(bits.discordId);
        if (again) return again;
        throw e2;
      }
    }
    throw e;
  }
}

function applySessionDefaults(session: { user?: { wakeGoal?: string; sleepGoal?: string; timezone?: string } }) {
  if (!session.user) return;
  session.user.wakeGoal = session.user.wakeGoal || "06:00";
  session.user.sleepGoal = session.user.sleepGoal || "23:00";
  session.user.timezone = session.user.timezone || "Asia/Kolkata";
}

export const authOptions: NextAuthOptions = {
  // No PrismaAdapter — Credentials + JWT is more reliable for demo login.
  // Discord users are upserted in the signIn callback.
  providers: [
    ...(discordConfigured
      ? [
          DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID!,
            clientSecret: process.env.DISCORD_CLIENT_SECRET!,
            authorization: { params: { scope: "identify email guilds" } },
          }),
        ]
      : []),
    CredentialsProvider({
      id: "demo",
      name: "Demo",
      credentials: {
        who: { label: "Who", type: "text" },
      },
      async authorize(credentials) {
        try {
          const who = credentials?.who === "friend" ? "friend" : "you";
          const user =
            who === "friend"
              ? await ensureDemoUser("friend@dawn.local", "Friend")
              : await ensureDemoUser("you@dawn.local", "You");
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: null,
          };
        } catch (e) {
          console.error("Demo authorize failed", e);
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "discord" && profile && "id" in profile) {
        const discordId = String((profile as { id: string }).id);
        const dbUser = await ensureDiscordUser({
          discordId,
          email: user.email,
          name: user.name,
          image: user.image,
        });
        user.id = dbUser.id;
        void enrollDiscordFriend({
          userId: dbUser.id,
          discordId,
        }).catch((e) => console.error("Discord enroll failed", e));
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "discord" && profile && "id" in profile) {
        const discordId = String((profile as { id: string }).id);
        token.discordId = discordId;
        // NextAuth ignores `user.id` set in signIn (no adapter). Create/find here
        // so the first Discord callback stores the Prisma cuid, not the snowflake.
        let dbUser;
        try {
          dbUser = await ensureDiscordUser({
            discordId,
            email: user?.email,
            name: user?.name,
            image: user?.image,
          });
        } catch (e) {
          console.error("Discord jwt ensure failed", e);
          dbUser = await findUserByDiscord(discordId);
        }
        if (dbUser) token.sub = dbUser.id;
        else if (user?.id && !isSnowflake(user.id)) token.sub = user.id;
      } else if (user?.id && !isSnowflake(user.id)) {
        token.sub = user.id;
      } else if (isSnowflake(token.sub) || token.discordId) {
        const dbUser = await resolveSessionUser(token);
        if (dbUser) token.sub = dbUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (!session.user) return session;
      try {
        const dbUser = await resolveSessionUser(token);
        if (dbUser) {
          session.user.id = dbUser.id;
          session.user.discordId = dbUser.discordId;
          session.user.wakeGoal = dbUser.wakeGoal;
          session.user.sleepGoal = dbUser.sleepGoal;
          session.user.timezone = dbUser.timezone;
          session.user.name = dbUser.name ?? session.user.name;
          session.user.image = dbUser.image ?? session.user.image;
          session.user.email = dbUser.email ?? session.user.email;
          session.user.onboardingDone = dbUser.onboardingDone;
          session.user.focusHabitKey = dbUser.focusHabitKey;
          session.user.identityLine = dbUser.identityLine;
          session.user.whyLine = dbUser.whyLine;
          session.user.xp = dbUser.xp;
          session.user.level = dbUser.level;
        } else if (token.sub && !isSnowflake(token.sub)) {
          session.user.id = token.sub;
          session.user.onboardingDone = false;
        }
      } catch (e) {
        console.error("session hydrate failed", e);
        if (token.sub && !isSnowflake(token.sub)) {
          session.user.id = token.sub;
          session.user.onboardingDone = false;
        }
      }
      applySessionDefaults(session);
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "dawn-dev-secret-change-me",
};
