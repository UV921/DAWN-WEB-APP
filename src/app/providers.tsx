"use client";

import { SessionProvider } from "next-auth/react";
import { AppPresenceTracker } from "@/components/AppPresenceTracker";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <AppPresenceTracker />
    </SessionProvider>
  );
}
