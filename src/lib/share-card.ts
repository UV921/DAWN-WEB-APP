export const SHARE_W = 1080;
export const SHARE_H = 1350;

export function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [text];
}

export function formatShareDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function slugShareName(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "card"
  );
}

export function paintShareFrame(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#071018";
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);

  const glow = ctx.createRadialGradient(
    SHARE_W * 0.5,
    -40,
    20,
    SHARE_W * 0.5,
    180,
    720
  );
  glow.addColorStop(0, "rgba(240,180,90,0.28)");
  glow.addColorStop(0.45, "rgba(224,122,58,0.08)");
  glow.addColorStop(1, "rgba(7,16,24,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SHARE_W, 640);

  const edge = ctx.createLinearGradient(0, 0, SHARE_W, 0);
  edge.addColorStop(0, "rgba(240,180,90,0)");
  edge.addColorStop(0.5, "rgba(240,180,90,0.55)");
  edge.addColorStop(1, "rgba(240,180,90,0)");
  ctx.fillStyle = edge;
  ctx.fillRect(80, 0, SHARE_W - 160, 4);

  ctx.fillStyle = "#f0b45a";
  ctx.font = "600 28px Sora, system-ui, sans-serif";
  ctx.fillText("D A W N", 88, 92);

  ctx.fillStyle = "rgba(214,226,236,0.35)";
  ctx.font = "500 22px Sora, system-ui, sans-serif";
  ctx.fillText("Made with Dawn", 88, SHARE_H - 64);
}

export function pathRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r = 8
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export async function exportShareCanvas(opts: {
  draw: (ctx: CanvasRenderingContext2D) => void;
  filename: string;
  title: string;
  text: string;
}): Promise<"shared" | "downloaded"> {
  if (typeof document === "undefined") {
    throw new Error("Share only works in the browser.");
  }
  await document.fonts.ready.catch(() => undefined);

  const canvas = document.createElement("canvas");
  canvas.width = SHARE_W;
  canvas.height = SHARE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn’t draw the card.");

  opts.draw(ctx);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Couldn’t make the image."))),
      "image/png"
    );
  });

  const file = new File([blob], opts.filename, { type: "image/png" });

  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: opts.title,
        text: opts.text,
      });
      return "shared";
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  return "downloaded";
}
