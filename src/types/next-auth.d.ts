import "next-auth";

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
