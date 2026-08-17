/** Browser helper: post today's tasks through the Vercel API (not the Northflank bot). */

export function isIosClient() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

type PostResult = {
  ok: boolean;
  status: number;
  error?: string;
  usedImage: boolean;
};

async function sendOnce(opts: {
  date: string;
  message?: string;
  image?: string;
}): Promise<PostResult> {
  const res = await fetch("/api/discord/send-todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      date: opts.date,
      message: opts.message || "",
      image: opts.image,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.ok) {
    return { ok: true, status: res.status, usedImage: Boolean(opts.image) };
  }
  return {
    ok: false,
    status: res.status,
    usedImage: Boolean(opts.image),
    error:
      res.status === 401
        ? "Sign in again, then try Send now."
        : (typeof data.error === "string" && data.error) ||
          "Couldn’t post to Discord.",
  };
}

/**
 * Post the task list. iPhone never attaches the PNG — a blob download or a
 * large JSON body aborts Safari's fetch and shows a fake "offline" error.
 * Other browsers try the image, then retry text-only if that fails.
 */
export async function postTodosFromBrowser(opts: {
  date: string;
  message?: string;
  image?: string;
}): Promise<PostResult> {
  const image = opts.image && !isIosClient() ? opts.image : undefined;

  try {
    const first = await sendOnce({ ...opts, image });
    if (first.ok || !image) return first;
    const retry = await sendOnce({ ...opts, image: undefined });
    return retry.ok ? retry : first;
  } catch (err) {
    if (image) {
      try {
        return await sendOnce({ ...opts, image: undefined });
      } catch {
        /* fall through */
      }
    }
    const detail = err instanceof Error ? err.message : "";
    return {
      ok: false,
      status: 0,
      usedImage: false,
      error: detail
        ? `Couldn’t reach Dawn to post (${detail}). Keep this screen open and try Send now again.`
        : "Couldn’t reach Dawn to post. Keep this screen open and try Send now again.",
    };
  }
}
