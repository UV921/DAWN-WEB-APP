/** Browser helper: post today's tasks through the Vercel API (not the Northflank bot). */

export function isIosClient() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  return /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
}

type PostResult = {
  ok: boolean;
  status: number;
  error?: string;
  usedImage: boolean;
};

function errorFromResponse(status: number, data: { error?: string }) {
  if (status === 401) return "Sign in again, then try Send now.";
  if (typeof data.error === "string" && data.error.trim()) return data.error;
  if (status === 413) {
    return "That image is too large to post. Dawn will retry the text list.";
  }
  return "Couldn’t post to Discord.";
}

async function readResult(res: Response, usedImage: boolean): Promise<PostResult> {
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    usedImage?: boolean;
  };
  if (res.ok) {
    return {
      ok: true,
      status: res.status,
      usedImage: Boolean(data.usedImage ?? usedImage),
    };
  }
  return {
    ok: false,
    status: res.status,
    usedImage: false,
    error: errorFromResponse(res.status, data),
  };
}

async function sendJson(opts: {
  date: string;
  message?: string;
  keepalive?: boolean;
}): Promise<PostResult> {
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({
      date: opts.date,
      message: opts.message || "",
    }),
  };
  if (opts.keepalive) init.keepalive = true;
  const res = await fetch("/api/discord/send-todos", init);
  return readResult(res, false);
}

async function sendCard(opts: {
  date: string;
  message?: string;
  image: Blob;
}): Promise<PostResult> {
  const filename =
    opts.image.type === "image/jpeg" ? "dawn-tasks.jpg" : "dawn-tasks.png";
  const file =
    opts.image instanceof File
      ? opts.image
      : new File([opts.image], filename, {
          type: opts.image.type || "image/png",
        });
  const form = new FormData();
  form.append("date", opts.date);
  form.append("message", opts.message || "");
  form.append("image", file, file.name);
  const res = await fetch("/api/discord/send-todos", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    body: form,
  });
  return readResult(res, true);
}

function offlineError(err: unknown): string {
  const detail = err instanceof Error ? err.message : "";
  if (/abort/i.test(detail)) {
    return "Send was interrupted. Keep this screen open and tap Send now again.";
  }
  if (detail && !/load failed|failed to fetch|networkerror/i.test(detail)) {
    return `Couldn’t reach Dawn to post (${detail}). Keep this screen open and try Send now again.`;
  }
  return "Couldn’t reach Dawn to post. Keep this screen open and try Send now again.";
}

/**
 * Post ping + the same card as Download PNG.
 * Uploads a real file (multipart), not base64 JSON — Safari aborts huge JSON.
 * If the card cannot be attached, the text list still goes out.
 */
export async function postTodosFromBrowser(opts: {
  date: string;
  message?: string;
  image?: Blob | File | null;
}): Promise<PostResult> {
  const image = opts.image && opts.image.size > 24 ? opts.image : undefined;
  const text = { date: opts.date, message: opts.message };

  if (image) {
    try {
      const withCard = await sendCard({ ...text, image });
      if (withCard.ok) return withCard;
    } catch {
      /* fall through to text */
    }
  }

  try {
    const listed = await sendJson(text);
    if (listed.ok) return { ...listed, usedImage: false };
    return listed;
  } catch (err) {
    try {
      return await sendJson({ ...text, keepalive: true });
    } catch (retryErr) {
      return {
        ok: false,
        status: 0,
        usedImage: false,
        error: offlineError(retryErr instanceof Error ? retryErr : err),
      };
    }
  }
}
