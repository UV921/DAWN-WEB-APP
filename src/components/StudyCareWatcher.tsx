"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { hasWebPushSubscription } from "@/lib/web-push-client";
import { studyNudgeBrowserSlot } from "@/lib/study-nudges";

type NudgeRow = {
  id: string;
  title: string;
  message: string;
  intervalMinutes: number;
  enabled: boolean;
  notifyBrowser: boolean;
};

type Live = { id: string; startedAt: string } | null;

/**
 * While Dawn is open: tick the server (Discord + Web Push) and fall back
 * to a local notification only if this device is not push-subscribed.
 */
export function StudyCareWatcher() {
  const { status } = useSession();
  const nudgesRef = useRef<NudgeRow[]>([]);
  const liveRef = useRef<Live>(null);
  const ticking = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    async function refresh() {
      try {
        const res = await fetch("/api/study-nudges", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        nudgesRef.current = (data.nudges || []) as NudgeRow[];
        liveRef.current = data.live || null;
      } catch {
        /* ignore */
      }
    }

    async function showLocal(n: NudgeRow, slot: number, sessionId: string) {
      if (
        typeof window === "undefined" ||
        !("Notification" in window) ||
        Notification.permission !== "granted"
      ) {
        return;
      }
      if (await hasWebPushSubscription()) return;
      const key = `dawn-study-${n.id}-${sessionId}-${slot}`;
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {
        /* private mode */
      }
      const body = n.message || "Take a short break, then back to it.";
      const opts: NotificationOptions = {
        body,
        icon: "/icons/icon-192.png",
        tag: `dawn-study-${n.id}`,
        data: { url: "/dashboard" },
      };
      try {
        if (navigator.serviceWorker?.ready) {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification(n.title, opts);
        } else {
          new Notification(n.title, opts);
        }
      } catch {
        /* ignore */
      }
    }

    async function tick() {
      if (ticking.current) return;
      ticking.current = true;
      try {
        const live = liveRef.current;
        if (!live) return;
        const now = new Date();
        const started = new Date(live.startedAt);
        for (const n of nudgesRef.current) {
          if (!n.enabled || !n.notifyBrowser) continue;
          const slot = studyNudgeBrowserSlot(started, now, n.intervalMinutes);
          if (slot < 1) continue;
          await showLocal(n, slot, live.id);
        }
        await fetch("/api/study-nudges/tick", {
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

    const boot = window.setTimeout(() => void refresh(), 2000);
    const first = window.setTimeout(() => void tick(), 4000);
    const listId = window.setInterval(() => void refresh(), 90_000);
    const tickId = window.setInterval(() => void tick(), 30_000);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void refresh().then(() => void tick());
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearTimeout(boot);
      window.clearTimeout(first);
      window.clearInterval(listId);
      window.clearInterval(tickId);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [status]);

  return null;
}
