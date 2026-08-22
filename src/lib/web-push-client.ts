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
