/** Browser helpers for VAPID Web Push. */

export function vapidKeyToBytes(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function webPushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export async function hasWebPushSubscription(): Promise<boolean> {
  if (!webPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    return Boolean(await reg.pushManager.getSubscription());
  } catch {
    return false;
  }
}

export async function subscribeWebPush(): Promise<{
  ok: boolean;
  reason?: string;
}> {
  if (!webPushSupported()) {
    return { ok: false, reason: "This browser does not support Web Push." };
  }
  if (Notification.permission !== "granted") {
    return { ok: false, reason: "Notification permission is off." };
  }

  const keyRes = await fetch("/api/push", { cache: "no-store" });
  if (!keyRes.ok) {
    return { ok: false, reason: "Could not load Web Push keys." };
  }
  const data = (await keyRes.json()) as { publicKey?: string };
  if (!data.publicKey) {
    return { ok: false, reason: "Web Push is not configured on the server." };
  }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKeyToBytes(data.publicKey) as BufferSource,
    });
  }

  const save = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!save.ok) {
    return { ok: false, reason: "Could not save this device for push." };
  }
  return { ok: true };
}

export async function requestAndSubscribeWebPush(): Promise<{
  ok: boolean;
  permission: NotificationPermission | "unsupported";
  reason?: string;
}> {
  if (!("Notification" in window)) {
    return { ok: false, permission: "unsupported" };
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, permission, reason: "Permission denied." };
  }
  const sub = await subscribeWebPush();
  return { ok: sub.ok, permission, reason: sub.reason };
}

export type DawnPushPreview = {
  title: string;
  body: string;
};

export function announceDawnPush(preview: DawnPushPreview) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("dawn-push", { detail: preview }));
}

/** Show a system banner even while Dawn is the focused tab. */
export async function showLocalDawnNotification(preview: DawnPushPreview) {
  announceDawnPush(preview);
  await showOsNotification({
    title: preview.title,
    body: preview.body,
    tag: "dawn-push-test",
    url: "/dashboard",
    sticky: true,
  });
}

export function notificationAssetUrl(path: string) {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).href;
}

/**
 * Native OS notification (Mac Notification Center / banners).
 * Relative icon URLs often fail silently on macOS Chrome/Safari.
 */
export async function showOsNotification(opts: {
  title: string;
  body: string;
  tag: string;
  url?: string;
  sticky?: boolean;
}) {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }
  const origin = window.location.origin;
  const nopts: NotificationOptions = {
    body: opts.body,
    icon: `${origin}/icons/icon-192.png`,
    badge: `${origin}/icons/icon-192.png`,
    tag: opts.tag,
    requireInteraction: opts.sticky !== false,
    silent: false,
    data: { url: opts.url || "/dashboard" },
  };
  try {
    if (navigator.serviceWorker?.ready) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(opts.title, nopts);
      return;
    }
  } catch {
    /* fall through */
  }
  try {
    new Notification(opts.title, nopts);
  } catch {
    /* ignore */
  }
}
