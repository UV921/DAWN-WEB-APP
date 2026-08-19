import "next-auth";
import "next-auth/jwt";

export type SessionUserCache = {
  id: string;
  discordId: string | null;
  wakeGoal: string;
  sleepGoal: string;
  timezone: string;
  name: string | null;
  image: string | null;
  email: string | null;
  onboardingDone: boolean;
  focusHabitKey: string;
  identityLine: string;
  whyLine: string;
  xp: number;
  level: number;
};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      discordId?: string | null;
      wakeGoal: string;
      sleepGoal: string;
      timezone: string;
      onboardingDone?: boolean;
      focusHabitKey?: string;
      identityLine?: string;
      whyLine?: string;
      xp?: number;
      level?: number;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discordId?: string;
    hydratedAt?: number;
    u?: SessionUserCache;
  }
}
