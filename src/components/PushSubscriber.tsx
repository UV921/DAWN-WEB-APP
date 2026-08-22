"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { subscribeWebPush, webPushSupported } from "@/lib/web-push-client";

/** Keep this device subscribed so the bot can Web Push after Dawn is closed. */
export function PushSubscriber() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!webPushSupported()) return;
    if (Notification.permission !== "granted") return;

    const id = window.setTimeout(() => {
      void subscribeWebPush();
    }, 2500);
    return () => window.clearTimeout(id);
  }, [status]);

  return null;
}
