import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

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
        const email =
          user.email || `${discordId}@users.noreply.discord.local`;

        // Prefer discordId (unique). Upsert-by-email alone fails when the same
        // Discord account returns a different email than an older row.
        let dbUser = await prisma.user.findUnique({ where: { discordId } });

        if (dbUser) {
          dbUser = await prisma.user.update({
            where: { id: dbUser.id },
            data: {
              name: user.name ?? dbUser.name,
              image: user.image ?? dbUser.image,
              // Keep a real Discord email when we get one; don't clobber with noreply
              ...(user.email && user.email !== dbUser.email
                ? {
                    email: await uniqueEmailOrKeep(
                      user.email,
                      dbUser.id,
                      dbUser.email
                    ),
                  }
                : {}),
            },
          });
        } else {
          const byEmail = await prisma.user.findUnique({ where: { email } });
          if (byEmail) {
            if (byEmail.discordId && byEmail.discordId !== discordId) {
              console.error("Email already linked to another Discord id", {
                email,
                discordId,
              });
              return false;
            }
            dbUser = await prisma.user.update({
              where: { id: byEmail.id },
              data: {
                name: user.name ?? byEmail.name,
                image: user.image ?? byEmail.image,
                discordId,
              },
            });
          } else {
            dbUser = await prisma.user.create({
              data: {
                email,
                name: user.name,
                image: user.image,
                discordId,
              },
            });
          }
        }

        user.id = dbUser.id;
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "discord" && profile && "id" in profile) {
        const discordId = String((profile as { id: string }).id);
        token.discordId = discordId;
        const dbUser = await findUserByDiscord(discordId);
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
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "dawn-dev-secret-change-me",
};
