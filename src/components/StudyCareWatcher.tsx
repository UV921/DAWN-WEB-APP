"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { showOsNotification } from "@/lib/web-push-client";
import { studyNudgeBrowserSlot } from "@/lib/study-nudges";
import {
  DAWN_STUDY_EVENT,
  type DawnStudyEventDetail,
} from "@/lib/study-session-events";

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
 * Study care OS banners + Discord/Web Push ticks — only while a session is live.
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

    async function confirmLive(): Promise<Live> {
      try {
        const res = await fetch("/api/study-nudges", { cache: "no-store" });
        if (!res.ok) return liveRef.current;
        const data = await res.json();
        nudgesRef.current = (data.nudges || []) as NudgeRow[];
        liveRef.current = data.live || null;
        return liveRef.current;
      } catch {
        return liveRef.current;
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
      const key = `dawn-study-${n.id}-${sessionId}-${slot}`;
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {
        /* private mode */
      }
      const hidden = document.visibilityState === "hidden";
      await showOsNotification({
        title: n.title,
        body: n.message || "Take a short break, then back to it.",
        tag: `dawn-study-${n.id}`,
        url: "/dashboard",
        sticky: hidden,
      });
    }

    async function tick() {
      if (ticking.current) return;
      ticking.current = true;
      try {
        const live = await confirmLive();
        if (!live) return;
        const now = new Date();
        const started = new Date(live.startedAt);
        for (const n of nudgesRef.current) {
          if (!n.enabled || !n.notifyBrowser) continue;
          const slot = studyNudgeBrowserSlot(started, now, n.intervalMinutes);
          if (slot < 1) continue;
          await showLocal(n, slot, live.id);
        }
        if (!(await confirmLive())) return;
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
      void refresh().then(() => void tick());
    };
    const onStudy = (event: Event) => {
      const detail = (event as CustomEvent<DawnStudyEventDetail>).detail;
      if (!detail?.live) {
        liveRef.current = null;
        return;
      }
      void refresh().then(() => void tick());
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(DAWN_STUDY_EVENT, onStudy);
    return () => {
      window.clearTimeout(boot);
      window.clearTimeout(first);
      window.clearInterval(listId);
      window.clearInterval(tickId);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(DAWN_STUDY_EVENT, onStudy);
    };
  }, [status]);

  return null;
}
