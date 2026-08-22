"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "dawn-pwa-dismiss-until";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
/** Bump with public/sw.js CACHE so Home Screen apps pick up a new worker. */
const SW_VERSION = "10";
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

const dismissSubs = new Set<() => void>();

function dismissInstallPrompt() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
  } catch {
    /* private mode */
  }
  dismissSubs.forEach((fn) => fn());
}

export function useDawnInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    cachedPrompt
  );
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [ios, setIos] = useState(false);

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
    const onDismiss = () => setDismissed(true);
    promptSubs.add(onPrompt);
    dismissSubs.add(onDismiss);
    return () => {
      promptSubs.delete(onPrompt);
      dismissSubs.delete(onDismiss);
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
    dismissInstallPrompt();
  }

  return {
    canInstall: Boolean(deferred) && !installed,
    ios: ios && !installed,
    installed,
    dismissed,
    install,
    dismiss,
  };
}

export function PwaRegister() {
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

  return null;
}
