"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

type ReminderRow = {
  id: string;
  title: string;
  message: string;
  time: string;
  enabled: boolean;
  notifyBrowser: boolean;
};

/**
 * While Dawn is open: browser notifications + Discord tick.
 * Discord also fires from the bot when it's running (works with app closed).
 */
export function ReminderWatcher() {
  const { status } = useSession();
  const remindersRef = useRef<ReminderRow[]>([]);
  const ticking = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    async function refreshList() {
      try {
        const res = await fetch("/api/reminders");
        if (!res.ok) return;
        const data = await res.json();
        remindersRef.current = (data.reminders || []) as ReminderRow[];
      } catch {
        /* ignore */
      }
    }

    async function tick() {
      if (ticking.current) return;
      ticking.current = true;
      try {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        const clock = `${hh}:${mm}`;
        const dayKey = now.toDateString();

        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          for (const r of remindersRef.current) {
            if (!r.enabled || !r.notifyBrowser || r.time !== clock) continue;
            const key = `dawn-br-${r.id}-${dayKey}-${clock}`;
            if (sessionStorage.getItem(key)) continue;
            sessionStorage.setItem(key, "1");
            const body = r.message || "Open Dawn and check in.";
            if (navigator.serviceWorker?.ready) {
              const reg = await navigator.serviceWorker.ready;
              await reg.showNotification(r.title, {
                body,
                icon: "/icons/icon-192.png",
                tag: `dawn-${r.id}`,
                data: { url: "/dashboard?ritual=1" },
              });
            } else {
              new Notification(r.title, {
                body,
                icon: "/icons/icon-192.png",
                tag: `dawn-${r.id}`,
              });
            }
          }
        }

        // Discord delivery (bot also does this when running)
        await fetch("/api/reminders/tick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
      } catch {
        /* ignore */
      } finally {
        ticking.current = false;
      }
    }

    void refreshList();
    void tick();
    const listId = window.setInterval(() => void refreshList(), 60_000);
    const tickId = window.setInterval(() => void tick(), 20_000);
    return () => {
      window.clearInterval(listId);
      window.clearInterval(tickId);
    };
  }, [status]);

  return null;
}
