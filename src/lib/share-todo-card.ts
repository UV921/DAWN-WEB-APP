import { slugListTitle } from "@/lib/todo-lists";

export type ShareTodoItem = { text: string; done: boolean };

const W = 1080;
const H = 1350;

function wrapLines(
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

function formatShareDate(date: string): string {
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

function drawCard(
  ctx: CanvasRenderingContext2D,
  opts: { listTitle: string; date: string; items: ShareTodoItem[] }
) {
  ctx.fillStyle = "#071018";
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.5, -40, 20, W * 0.5, 180, 720);
  glow.addColorStop(0, "rgba(240,180,90,0.28)");
  glow.addColorStop(0.45, "rgba(224,122,58,0.08)");
  glow.addColorStop(1, "rgba(7,16,24,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 640);

  const edge = ctx.createLinearGradient(0, 0, W, 0);
  edge.addColorStop(0, "rgba(240,180,90,0)");
  edge.addColorStop(0.5, "rgba(240,180,90,0.55)");
  edge.addColorStop(1, "rgba(240,180,90,0)");
  ctx.fillStyle = edge;
  ctx.fillRect(80, 0, W - 160, 4);

  ctx.fillStyle = "#f0b45a";
  ctx.font = "600 28px Sora, system-ui, sans-serif";
  ctx.fillText("D A W N", 88, 92);

  ctx.fillStyle = "#f0b45a";
  ctx.font = "600 72px Fraunces, Georgia, serif";
  const titleLines = wrapLines(ctx, opts.listTitle, W - 176).slice(0, 2);
  let y = 200;
  for (const line of titleLines) {
    ctx.fillText(line, 88, y);
    y += 82;
  }

  ctx.fillStyle = "#8ba3b8";
  ctx.font = "400 28px Sora, system-ui, sans-serif";
  ctx.fillText(formatShareDate(opts.date), 88, y + 8);

  ctx.fillStyle = "rgba(240,180,90,0.28)";
  ctx.fillRect(88, y + 36, 160, 3);

  const maxItems = 12;
  const shown = opts.items.slice(0, maxItems);
  const extra = opts.items.length - shown.length;
  y += 110;

  for (const item of shown) {
    const boxY = y - 28;
    ctx.strokeStyle = item.done ? "#6fbf8a" : "rgba(240,180,90,0.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(88, boxY, 36, 36, 8);
    ctx.stroke();
    if (item.done) {
      ctx.fillStyle = "rgba(111,191,138,0.18)";
      ctx.fill();
      ctx.strokeStyle = "#6fbf8a";
      ctx.beginPath();
      ctx.moveTo(96, boxY + 18);
      ctx.lineTo(102, boxY + 26);
      ctx.lineTo(116, boxY + 10);
      ctx.stroke();
    }

    ctx.fillStyle = item.done ? "#8ba3b8" : "#d6e2ec";
    ctx.font = `${item.done ? "400" : "500"} 34px Sora, system-ui, sans-serif`;
    const lines = wrapLines(ctx, item.text, W - 260).slice(0, 2);
    let ly = y;
    for (const line of lines) {
      ctx.fillText(line, 148, ly);
      ly += 40;
    }
    y = ly + 28;
    if (y > H - 160) break;
  }

  if (extra > 0) {
    ctx.fillStyle = "#8ba3b8";
    ctx.font = "500 26px Sora, system-ui, sans-serif";
    ctx.fillText(`+${extra} more`, 88, Math.min(y + 8, H - 120));
  }

  ctx.fillStyle = "rgba(214,226,236,0.35)";
  ctx.font = "500 22px Sora, system-ui, sans-serif";
  ctx.fillText("Made with Dawn", 88, H - 64);
}

export async function shareTodoListCard(opts: {
  listTitle: string;
  date: string;
  items: ShareTodoItem[];
}): Promise<"shared" | "downloaded"> {
  if (typeof document === "undefined") {
    throw new Error("Share only works in the browser.");
  }
  await document.fonts.ready.catch(() => undefined);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn’t draw the card.");

  if ("roundRect" in ctx === false) {
    (
      ctx as CanvasRenderingContext2D & {
        roundRect: typeof ctx.roundRect;
      }
    ).roundRect = function (x, y, w, h) {
      this.rect(x, y, w, h);
    };
  }

  drawCard(ctx, opts);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Couldn’t make the image."))),
      "image/png"
    );
  });

  const filename = `dawn-${slugListTitle(opts.listTitle)}.png`;
  const file = new File([blob], filename, { type: "image/png" });

  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: opts.listTitle,
        text: `${opts.listTitle} — from Dawn`,
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
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  return "downloaded";
}
