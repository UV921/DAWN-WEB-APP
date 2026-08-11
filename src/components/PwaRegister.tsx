"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaRegister() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* ignore */
      });
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS
      ("standalone" in navigator &&
        (navigator as Navigator & { standalone?: boolean }).standalone === true);
    if (standalone) setInstalled(true);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setDeferred(null);
    });

    const wasDismissed = localStorage.getItem("dawn-pwa-dismiss") === "1";
    if (wasDismissed) setDismissed(true);

    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  function dismiss() {
    setDismissed(true);
    localStorage.setItem("dawn-pwa-dismiss", "1");
  }

  if (installed || dismissed || !deferred) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border border-white/15 bg-[#0d1b2a]/95 p-4 shadow-2xl backdrop-blur md:left-auto">
      <p className="font-display text-lg text-white">Install Dawn</p>
      <p className="mt-1 text-sm text-[var(--color-mist)]">
        Add to your home screen — opens like an app, faster morning check-in.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void install()}
          className="rounded-full bg-[var(--color-dawn)] px-4 py-2 text-sm font-semibold text-[var(--color-night)]"
        >
          Install
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full border border-white/20 px-4 py-2 text-sm text-[var(--color-mist)]"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
