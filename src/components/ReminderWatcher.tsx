"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { hasWebPushSubscription } from "@/lib/web-push-client";

type ReminderRow = {
  id: string;
  title: string;
  message: string;
  time: string;
  enabled: boolean;
  notifyBrowser: boolean;
  todoId?: string | null;
  todo?: { done: boolean; date: string } | null;
};

/**
 * While Dawn is open: tick Discord + Web Push.
 * Local notifications are only a fallback if this device is not push-subscribed.
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
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

        const useLocal =
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted" &&
          !(await hasWebPushSubscription());

        if (useLocal) {
          for (const r of remindersRef.current) {
            if (!r.enabled || !r.notifyBrowser || r.time !== clock) continue;
            if (r.todo && (r.todo.done || r.todo.date !== today)) continue;
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

    const boot = window.setTimeout(() => {
      void refreshList();
    }, 2500);
    const firstTick = window.setTimeout(() => void tick(), 5000);
    const listId = window.setInterval(() => void refreshList(), 180_000);
    const tickId = window.setInterval(() => void tick(), 60_000);
    return () => {
      window.clearTimeout(boot);
      window.clearTimeout(firstTick);
      window.clearInterval(listId);
      window.clearInterval(tickId);
    };
  }, [status]);

  return null;
}
