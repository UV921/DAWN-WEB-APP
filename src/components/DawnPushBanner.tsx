"use client";

import { useEffect, useState } from "react";
import type { DawnPushPreview } from "@/lib/web-push-client";

/**
 * In-app banner so a test / care ping is visible on the page.
 * Chrome on Mac often hides the system banner while Dawn is focused.
 */
export function DawnPushBanner() {
  const [preview, setPreview] = useState<DawnPushPreview | null>(null);

  useEffect(() => {
    function onPreview(event: Event) {
      const detail = (event as CustomEvent<DawnPushPreview>).detail;
      if (detail?.title) setPreview(detail);
    }
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (data && data.type === "dawn-push" && data.title) {
        setPreview({ title: String(data.title), body: String(data.body || "") });
      }
    }
    window.addEventListener("dawn-push", onPreview);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("dawn-push", onPreview);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, []);

  useEffect(() => {
    if (!preview) return;
    const id = window.setTimeout(() => setPreview(null), 12_000);
    return () => window.clearTimeout(id);
  }, [preview]);

  if (!preview) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-[80] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-[var(--color-dawn)]/50 bg-[#121820] px-4 py-3 shadow-2xl"
    >
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-[var(--color-dawn)]">
        Dawn ping
      </p>
      <p className="mt-1 font-medium text-white">{preview.title}</p>
      {preview.body ? (
        <p className="mt-0.5 text-sm text-[var(--color-mist)]">{preview.body}</p>
      ) : null}
      <p className="mt-2 text-xs text-[var(--color-mist)]">
        Also check the top-right Notification Center if the system banner is
        hidden while Dawn is open.
      </p>
    </div>
  );
}