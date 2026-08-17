/** Browser helper: post today's tasks through the Vercel API (not the Northflank bot). */

export function isIosClient() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  // iPadOS 13+ reports as Macintosh.
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
    return "That image is too large to post. Try Send now without the PNG.";
  }
  return "Couldn’t post to Discord.";
}

async function sendOnce(opts: {
  date: string;
  message?: string;
  image?: string;
  keepalive?: boolean;
}): Promise<PostResult> {
  const usedImage = Boolean(opts.image);
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({
      date: opts.date,
      message: opts.message || "",
      image: opts.image,
    }),
  };
  // Only set keepalive when we mean it — some iOS builds throw on the flag.
  if (opts.keepalive) init.keepalive = true;
  const res = await fetch("/api/discord/send-todos", init);
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.ok) {
    return { ok: true, status: res.status, usedImage };
  }
  return {
    ok: false,
    status: res.status,
    usedImage,
    error: errorFromResponse(res.status, data),
  };
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
 * Post the task list. iPhone never attaches the PNG — drawing a card or
 * stuffing a huge JSON body makes Safari abort the fetch (`TypeError: Load
 * failed`) and we used to show a fake “offline” banner. Other browsers try
 * the image, then retry text-only if that fails.
 */
export async function postTodosFromBrowser(opts: {
  date: string;
  message?: string;
  image?: string;
}): Promise<PostResult> {
  const image = opts.image && !isIosClient() ? opts.image : undefined;
  const text = { date: opts.date, message: opts.message };

  try {
    const first = await sendOnce({ ...text, image });
    if (first.ok || !image) return first;
    const retry = await sendOnce(text);
    return retry.ok ? retry : first;
  } catch (err) {
    if (image) {
      try {
        return await sendOnce(text);
      } catch {
        /* fall through */
      }
    }
    try {
      return await sendOnce({ ...text, keepalive: true });
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
