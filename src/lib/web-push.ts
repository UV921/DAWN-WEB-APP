/**
 * Web Push (VAPID). The bot and /api ticks send these so browser alerts
 * still arrive after Dawn is fully closed.
 *
 * Keys: VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY (+ optional VAPID_SUBJECT),
 * or a generated pair stored on AppConfig (shared Neon DB).
 */

import webpush from "web-push";
import type { PrismaClient } from "@prisma/client";

export type WebPushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type WebPushSendResult = {
  sent: number;
  gone: number;
  error?: string;
};

function vapidSubject() {
  const fromEnv = process.env.VAPID_SUBJECT?.trim();
  if (fromEnv) return fromEnv;
  const site = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "");
  if (site) {
    try {
      return `mailto:dawn@${new URL(site).hostname}`;
    } catch {
      /* fall through */
    }
  }
  return "mailto:dawn@localhost";
}

export async function getVapidPublicKey(
  prisma: PrismaClient
): Promise<string | null> {
  const keys = await ensureVapidKeys(prisma);
  return keys?.publicKey || null;
}

export async function ensureVapidKeys(prisma: PrismaClient): Promise<{
  publicKey: string;
  privateKey: string;
  subject: string;
} | null> {
  const envPublic = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPrivate = process.env.VAPID_PRIVATE_KEY?.trim();

  const row = await prisma.appConfig.findUnique({ where: { id: "app" } });
  if (row?.vapidPublic && row.vapidPrivate) {
    return {
      publicKey: row.vapidPublic,
      privateKey: row.vapidPrivate,
      subject: row.vapidSubject || vapidSubject(),
    };
  }

  if (envPublic && envPrivate) {
    const subject = vapidSubject();
    await prisma.appConfig
      .upsert({
        where: { id: "app" },
        create: {
          id: "app",
          vapidPublic: envPublic,
          vapidPrivate: envPrivate,
          vapidSubject: subject,
        },
        update: {},
      })
      .catch(() => undefined);
    return { publicKey: envPublic, privateKey: envPrivate, subject };
  }

  const generated = webpush.generateVAPIDKeys();
  const subject = vapidSubject();
  try {
    const saved = await prisma.appConfig.upsert({
      where: { id: "app" },
      create: {
        id: "app",
        vapidPublic: generated.publicKey,
        vapidPrivate: generated.privateKey,
        vapidSubject: subject,
      },
      update: {},
    });
    if (saved.vapidPublic && saved.vapidPrivate) {
      return {
        publicKey: saved.vapidPublic,
        privateKey: saved.vapidPrivate,
        subject: saved.vapidSubject || subject,
      };
    }
    const filled = await prisma.appConfig.update({
      where: { id: "app" },
      data: {
        vapidPublic: generated.publicKey,
        vapidPrivate: generated.privateKey,
        vapidSubject: subject,
      },
    });
    return {
      publicKey: filled.vapidPublic,
      privateKey: filled.vapidPrivate,
      subject: filled.vapidSubject || subject,
    };
  } catch {
    const again = await prisma.appConfig.findUnique({ where: { id: "app" } });
    if (again?.vapidPublic && again.vapidPrivate) {
      return {
        publicKey: again.vapidPublic,
        privateKey: again.vapidPrivate,
        subject: again.vapidSubject || subject,
      };
    }
    return null;
  }
}

async function applyVapid(prisma: PrismaClient): Promise<boolean> {
  const keys = await ensureVapidKeys(prisma);
  if (!keys) return false;
  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
  return true;
}

export function parsePushSubscription(raw: unknown): {
  endpoint: string;
  p256dh: string;
  auth: string;
} | null {
  const v = (raw ?? {}) as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  const endpoint = String(v.endpoint || "").trim();
  const p256dh = String(v.keys?.p256dh || "").trim();
  const auth = String(v.keys?.auth || "").trim();
  if (!endpoint.startsWith("https://") || !p256dh || !auth) return null;
  return { endpoint, p256dh, auth };
}

export async function sendWebPushToUser(
  prisma: PrismaClient,
  userId: string,
  payload: WebPushPayload
): Promise<WebPushSendResult> {
  if (!(await applyVapid(prisma))) {
    return { sent: 0, gone: 0, error: "Web Push keys are not configured" };
  }

  const rows = await prisma.pushSubscription.findMany({ where: { userId } });
  if (rows.length === 0) return { sent: 0, gone: 0 };

  const body = JSON.stringify({
    title: payload.title.slice(0, 80),
    body: (payload.body || "").slice(0, 240),
    url: payload.url || "/dashboard",
    tag: payload.tag || "dawn",
  });

  let sent = 0;
  let gone = 0;
  let error: string | undefined;

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          body,
          { TTL: 3600, urgency: "high" }
        );
        sent += 1;
      } catch (e) {
        const status =
          e && typeof e === "object" && "statusCode" in e
            ? Number((e as { statusCode?: number }).statusCode)
            : 0;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription
            .deleteMany({ where: { id: row.id } })
            .catch(() => undefined);
          gone += 1;
          return;
        }
        error = e instanceof Error ? e.message : "Push failed";
      }
    })
  );

  return { sent, gone, error };
}
