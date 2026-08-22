import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getVapidPublicKey,
  parsePushSubscription,
  sendWebPushToUser,
} from "@/lib/web-push";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [publicKey, count] = await Promise.all([
    getVapidPublicKey(prisma),
    prisma.pushSubscription.count({ where: { userId: session.user.id } }),
  ]);

  return NextResponse.json({
    publicKey,
    subscribed: count > 0,
    devices: count,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.test === true || body.action === "test") {
    const result = await sendWebPushToUser(prisma, session.user.id, {
      title: "Dawn Web Push",
      body: "This reaches you even if Dawn is closed.",
      url: "/dashboard",
      tag: "dawn-push-test",
    });
    if (result.sent === 0) {
      return NextResponse.json(
        {
          error:
            result.error ||
            "No device subscribed yet. Allow notifications on this device first.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true, ...result });
  }

  const parsed = parsePushSubscription(body);
  if (!parsed) {
    return NextResponse.json(
      { error: "A valid PushSubscription is required." },
      { status: 400 }
    );
  }

  const userAgent = String(req.headers.get("user-agent") || "").slice(0, 240);
  const row = await prisma.pushSubscription.upsert({
    where: { endpoint: parsed.endpoint },
    create: {
      userId: session.user.id,
      endpoint: parsed.endpoint,
      p256dh: parsed.p256dh,
      auth: parsed.auth,
      userAgent,
    },
    update: {
      userId: session.user.id,
      p256dh: parsed.p256dh,
      auth: parsed.auth,
      userAgent,
    },
  });

  return NextResponse.json({ ok: true, id: row.id });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const endpoint = String(body.endpoint || "").trim();
  if (endpoint) {
    await prisma.pushSubscription.deleteMany({
      where: { userId: session.user.id, endpoint },
    });
  } else {
    await prisma.pushSubscription.deleteMany({
      where: { userId: session.user.id },
    });
  }
  return NextResponse.json({ ok: true });
}
