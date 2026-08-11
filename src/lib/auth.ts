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
          user.email ||
          `${discordId}@users.noreply.discord.local`;
        const dbUser = await prisma.user.upsert({
          where: { email },
          create: {
            email,
            name: user.name,
            image: user.image,
            discordId,
          },
          update: {
            name: user.name,
            image: user.image,
            discordId,
          },
        });
        user.id = dbUser.id;
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (user?.id) {
        token.sub = user.id;
      }
      if (account?.provider === "discord" && profile && "id" in profile) {
        token.discordId = String((profile as { id: string }).id);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
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
          },
        });
        session.user.discordId =
          dbUser?.discordId ?? (token.discordId as string | undefined) ?? null;
        session.user.wakeGoal = dbUser?.wakeGoal ?? "06:00";
        session.user.sleepGoal = dbUser?.sleepGoal ?? "23:00";
        session.user.timezone = dbUser?.timezone ?? "Asia/Kolkata";
        session.user.name = dbUser?.name ?? session.user.name;
        session.user.image = dbUser?.image ?? session.user.image;
        session.user.email = dbUser?.email ?? session.user.email;
        session.user.onboardingDone = dbUser?.onboardingDone ?? false;
        session.user.focusHabitKey = dbUser?.focusHabitKey ?? "wakeEarly";
        session.user.identityLine = dbUser?.identityLine ?? "";
        session.user.whyLine = dbUser?.whyLine ?? "";
        session.user.xp = dbUser?.xp ?? 0;
        session.user.level = dbUser?.level ?? 1;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "dawn-dev-secret-change-me",
};
