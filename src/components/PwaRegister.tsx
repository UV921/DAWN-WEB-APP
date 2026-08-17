"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "dawn-pwa-dismiss-until";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
/** Bump with public/sw.js CACHE so Home Screen apps pick up a new worker. */
const SW_VERSION = "6";
const CHUNK_RELOAD_KEY = "dawn-chunk-reloaded";

let cachedPrompt: BeforeInstallPromptEvent | null = null;
const promptSubs = new Set<(event: BeforeInstallPromptEvent | null) => void>();
let reloadingForSw = false;

function isStandaloneWindow() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isDismissed() {
  const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
  return until > Date.now();
}

function isStaleChunkMessage(message: string) {
  return /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(
    message
  );
}

function reloadOnce(storageKey: string, value: string) {
  if (reloadingForSw) return;
  try {
    if (sessionStorage.getItem(storageKey) === value) return;
    sessionStorage.setItem(storageKey, value);
  } catch {
    /* private mode */
  }
  reloadingForSw = true;
  window.location.reload();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    cachedPrompt = event as BeforeInstallPromptEvent;
    promptSubs.forEach((fn) => fn(cachedPrompt));
  });
  window.addEventListener("appinstalled", () => {
    cachedPrompt = null;
    promptSubs.forEach((fn) => fn(null));
  });
  window.addEventListener("error", (event) => {
    if (isStaleChunkMessage(event.message || "")) {
      reloadOnce(CHUNK_RELOAD_KEY, SW_VERSION);
    }
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      typeof reason === "string"
        ? reason
        : reason instanceof Error
          ? `${reason.name} ${reason.message}`
          : "";
    if (isStaleChunkMessage(message)) {
      reloadOnce(CHUNK_RELOAD_KEY, SW_VERSION);
    }
  });
}

export function PwaRegister() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    cachedPrompt
  );
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [ios, setIos] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const onControllerChange = () => {
        reloadOnce("dawn-sw-reloaded", SW_VERSION);
      };
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        onControllerChange
      );
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .catch(() => {
          /* ignore */
        });
      return () => {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          onControllerChange
        );
      };
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (isStandaloneWindow()) {
      setInstalled(true);
      return;
    }

    setIos(isIosDevice());
    setDismissed(isDismissed());
    setDeferred(cachedPrompt);

    const onPrompt = (event: BeforeInstallPromptEvent | null) => {
      setDeferred(event);
      if (!event) setInstalled(true);
    };
    promptSubs.add(onPrompt);

    const show = window.setTimeout(() => setReady(true), 900);

    return () => {
      promptSubs.delete(onPrompt);
      window.clearTimeout(show);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    cachedPrompt = null;
    if (choice.outcome === "accepted") setInstalled(true);
  }

  function dismiss() {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
  }

  if (!ready || installed || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border border-white/15 bg-[#0d1b2a]/95 p-4 shadow-2xl backdrop-blur md:left-auto">
      <p className="font-display text-lg text-white">Install Dawn</p>
      <p className="mt-1 text-sm text-[var(--color-mist)]">
        {ios
          ? "Add it to your Home Screen — tap Share, then Add to Home Screen."
          : "Open Dawn like an app. Faster morning check-in, works offline."}
      </p>
      <div className="mt-3 flex gap-2">
        {deferred ? (
          <button
            type="button"
            onClick={() => void install()}
            className="rounded-full bg-[var(--color-dawn)] px-4 py-2 text-sm font-semibold text-[var(--color-night)]"
          >
            Install
          </button>
        ) : null}
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
