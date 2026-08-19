"use client";

/**
 * Tracks real app opens using:
 * - Page Visibility API (tab / PWA foreground)
 * - pageshow / focus (resume)
 * - Optional DeviceMotion (phone picked up) after permission
 *
 * Browsers cannot read native alarm clocks; this is the honest sensor stack.
 */

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

function isStandalone() {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const ios =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || ios;
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

async function ping(source: string) {
  const now = Date.now();
  if (now - lastPingAt < 45_000 && source !== "cold") return;
  lastPingAt = now;
  try {
    await fetch("/api/opens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source,
        standalone: isStandalone(),
        time: nowHHMM(),
      }),
      keepalive: true,
    });
  } catch {
    /* offline — ignore */
  }
}

let lastPingAt = 0;

export function AppPresenceTracker() {
  const { status } = useSession();
  const lastMotion = useRef(0);
  const motionOn = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    const boot = window.setTimeout(() => void ping("cold"), 1500);

    function onVis() {
      if (document.visibilityState === "visible") void ping("visibility");
    }
    function onFocus() {
      void ping("focus");
    }
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) void ping("resume");
    }

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.clearTimeout(boot);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (typeof window === "undefined") return;

    if (sessionStorage.getItem("dawn-motion") === "1") {
      motionOn.current = true;
    }

    function enable() {
      motionOn.current = true;
      sessionStorage.setItem("dawn-motion", "1");
    }

    function onMotion(ev: DeviceMotionEvent) {
      if (!motionOn.current) return;
      const a = ev.accelerationIncludingGravity;
      if (!a) return;
      const mag = Math.sqrt(
        (a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2
      );
      if (mag < 15) return;
      const now = Date.now();
      if (now - lastMotion.current < 120_000) return;
      const h = new Date().getHours();
      if (h < 4 || h > 11) return;
      if (document.visibilityState !== "visible") return;
      lastMotion.current = now;
      void ping("motion");
    }

    window.addEventListener("dawn-motion-on", enable);
    window.addEventListener("devicemotion", onMotion);
    return () => {
      window.removeEventListener("dawn-motion-on", enable);
      window.removeEventListener("devicemotion", onMotion);
    };
  }, [status]);

  return null;
}

/** iOS requires a user gesture for motion permission. */
export async function enableMotionSensing(): Promise<boolean> {
  try {
    const DM = DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<PermissionState>;
    };
    if (typeof DM.requestPermission === "function") {
      const state = await DM.requestPermission();
      if (state !== "granted") return false;
    }
    sessionStorage.setItem("dawn-motion", "1");
    window.dispatchEvent(new Event("dawn-motion-on"));
    return true;
  } catch {
    return false;
  }
}
