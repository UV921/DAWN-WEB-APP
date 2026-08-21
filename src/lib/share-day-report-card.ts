import {
  exportShareCanvas,
  formatShareDate,
  paintShareFrame,
  pathRoundRect,
  SHARE_H,
  SHARE_W,
  slugShareName,
  wrapLines,
} from "@/lib/share-card";
import { splitTodayTasks, type ReportTodo } from "@/lib/today-task-report";

export type ShareDayHabit = { label: string; done: boolean };

function ellipsize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number
): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) {
    s = s.slice(0, -1);
  }
  return `${s}…`;
}

function paintRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  pct: number
) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 16;
  ctx.stroke();

  const span = Math.max(0, Math.min(100, pct)) / 100;
  if (span <= 0) return;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * span);
  ctx.strokeStyle = pct >= 100 ? "#6fbf8a" : "#f0b45a";
  ctx.lineCap = "round";
  ctx.lineWidth = 16;
  ctx.stroke();
}

function paintCheck(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  done: boolean
) {
  const size = 32;
  ctx.beginPath();
  pathRoundRect(ctx, x, y, size, size, 8);
  if (done) {
    ctx.fillStyle = "rgba(111,191,138,0.2)";
    ctx.fill();
    ctx.strokeStyle = "#6fbf8a";
  } else {
    ctx.strokeStyle = "rgba(240,180,90,0.55)";
  }
  ctx.lineWidth = 2.5;
  ctx.stroke();
  if (done) {
    ctx.strokeStyle = "#6fbf8a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 17);
    ctx.lineTo(x + 13, y + 23);
    ctx.lineTo(x + 24, y + 10);
    ctx.stroke();
  }
}

function paintTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string
) {
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.beginPath();
  pathRoundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(240,180,90,0.2)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#8ba3b8";
  ctx.font = "500 15px Sora, system-ui, sans-serif";
  ctx.fillText(label.toUpperCase(), x + 16, y + 32);
  ctx.fillStyle = "#f0b45a";
  ctx.font = "600 32px Fraunces, Georgia, serif";
  ctx.fillText(ellipsize(ctx, value, w - 32), x + 16, y + 74);
}

/**
 * Portrait recap of one day: ring + scores + the tasks you actually closed.
 * Meant to be saved or posted from Progress.
 */
export async function shareDayReportCard(opts: {
  name?: string;
  date: string;
  kicker: string;
  headline: string;
  next?: string;
  wakeValue: string;
  habitValue: string;
  taskValue: string;
  studyValue: string;
  habits: ShareDayHabit[];
  tasks: ReportTodo[];
}): Promise<"shared" | "downloaded"> {
  const split = splitTodayTasks(opts.tasks);
  const ringPct = split.total
    ? split.pct
    : opts.habits.length
      ? Math.round(
          (opts.habits.filter((h) => h.done).length / opts.habits.length) * 100
        )
      : 0;
  const ringLabel = split.total
    ? `${split.doneCount}/${split.total}`
    : opts.habits.length
      ? `${opts.habits.filter((h) => h.done).length}/${opts.habits.length}`
      : "—";
  const ringHint = split.total ? "tasks closed" : "habits closed";

  return exportShareCanvas({
    filename: `dawn-today-${slugShareName(opts.date)}.png`,
    title: "Today on Dawn",
    text: `${opts.headline} — from Dawn`,
    draw: (ctx) => {
      paintShareFrame(ctx);

      ctx.fillStyle = "#f0b45a";
      ctx.font = "600 64px Fraunces, Georgia, serif";
      ctx.fillText("Today", 88, 188);

      ctx.fillStyle = "#8ba3b8";
      ctx.font = "400 24px Sora, system-ui, sans-serif";
      const who = [opts.name, formatShareDate(opts.date), opts.kicker]
        .filter(Boolean)
        .join(" · ");
      ctx.fillText(who, 88, 232);

      ctx.fillStyle = "rgba(240,180,90,0.28)";
      ctx.fillRect(88, 254, 160, 3);

      ctx.fillStyle = "#d6e2ec";
      ctx.font = "500 28px Sora, system-ui, sans-serif";
      let y = 304;
      for (const line of wrapLines(ctx, opts.headline, SHARE_W - 176).slice(0, 2)) {
        ctx.fillText(line, 88, y);
        y += 38;
      }

      y += 18;
      const scoreH = 248;
      ctx.fillStyle = "rgba(255,255,255,0.035)";
      ctx.beginPath();
      pathRoundRect(ctx, 88, y, SHARE_W - 176, scoreH, 24);
      ctx.fill();
      ctx.strokeStyle = "rgba(240,180,90,0.16)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const cx = 236;
      const cy = y + scoreH / 2;
      paintRing(ctx, cx, cy, 86, ringPct);
      ctx.fillStyle = "#f0b45a";
      ctx.font = "600 44px Fraunces, Georgia, serif";
      const mid = String(ringPct);
      const midW = ctx.measureText(mid).width;
      ctx.fillText(mid, cx - midW / 2, cy + 6);
      ctx.fillStyle = "#8ba3b8";
      ctx.font = "500 16px Sora, system-ui, sans-serif";
      ctx.fillText("%", cx + midW / 2 + 4, cy + 4);
      ctx.fillStyle = "#d6e2ec";
      ctx.font = "600 20px Fraunces, Georgia, serif";
      ctx.fillText(ringLabel, cx - ctx.measureText(ringLabel).width / 2, cy + 42);
      ctx.fillStyle = "#8ba3b8";
      ctx.font = "500 14px Sora, system-ui, sans-serif";
      ctx.fillText(
        ringHint.toUpperCase(),
        cx - ctx.measureText(ringHint.toUpperCase()).width / 2,
        cy + 64
      );

      const tileX = 390;
      const tileW = 268;
      const tileH = 96;
      const gap = 14;
      const tiles = [
        { label: "Wake", value: opts.wakeValue },
        { label: "Habits", value: opts.habitValue },
        { label: "Tasks", value: opts.taskValue },
        { label: "Study", value: opts.studyValue },
      ];
      tiles.forEach((tile, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        paintTile(
          ctx,
          tileX + col * (tileW + gap),
          y + 24 + row * (tileH + gap),
          tileW,
          tileH,
          tile.label,
          tile.value
        );
      });

      y += scoreH + 44;
      const footerTop = SHARE_H - 200;
      const hasNext = Boolean(opts.next);
      const listBottom = hasNext ? footerTop - 24 : SHARE_H - 120;

      const done = split.done;
      const open = split.open;
      const showOpen = done.length < 6 && open.length > 0;

      ctx.fillStyle = "#f0b45a";
      ctx.font = "600 18px Sora, system-ui, sans-serif";
      ctx.fillText("FINISHED TODAY", 88, y);
      ctx.fillStyle = "#8ba3b8";
      ctx.font = "500 18px Sora, system-ui, sans-serif";
      const count = split.total ? `${split.doneCount} of ${split.total}` : "no list";
      ctx.fillText(count, SHARE_W - 88 - ctx.measureText(count).width, y);
      y += 28;

      if (!done.length) {
        ctx.fillStyle = "#8ba3b8";
        ctx.font = "400 24px Sora, system-ui, sans-serif";
        ctx.fillText(
          split.total
            ? "Nothing checked off yet."
            : "No tasks on today’s list.",
          88,
          y + 28
        );
        y += 56;
      } else {
        const rowH = 52;
        const room = listBottom - y - (showOpen ? 90 : 0);
        const maxRows = Math.max(1, Math.floor(room / rowH));
        const shown = done.slice(0, maxRows);
        const extra = done.length - shown.length;
        for (const item of shown) {
          paintCheck(ctx, 88, y, true);
          ctx.fillStyle = "#d6e2ec";
          ctx.font = "500 26px Sora, system-ui, sans-serif";
          ctx.fillText(ellipsize(ctx, item.text, SHARE_W - 250), 140, y + 24);
          y += rowH;
        }
        if (extra > 0) {
          ctx.fillStyle = "#8ba3b8";
          ctx.font = "500 22px Sora, system-ui, sans-serif";
          ctx.fillText(`+${extra} more closed`, 88, y + 8);
          y += 36;
        }
      }

      if (showOpen && y + 80 < listBottom) {
        y += 8;
        ctx.fillStyle = "#e07a3a";
        ctx.font = "600 18px Sora, system-ui, sans-serif";
        ctx.fillText("STILL OPEN", 88, y);
        y += 20;
        const room = listBottom - y;
        const maxRows = Math.max(1, Math.floor(room / 52));
        for (const item of open.slice(0, maxRows)) {
          paintCheck(ctx, 88, y, false);
          ctx.fillStyle = "#d6e2ec";
          ctx.font = "500 26px Sora, system-ui, sans-serif";
          ctx.fillText(ellipsize(ctx, item.text, SHARE_W - 250), 140, y + 24);
          y += 52;
        }
        if (open.length > maxRows) {
          ctx.fillStyle = "#8ba3b8";
          ctx.font = "500 20px Sora, system-ui, sans-serif";
          ctx.fillText(`+${open.length - maxRows} still open`, 88, y + 4);
        }
      }

      const closedHabits = opts.habits.filter((h) => h.done).map((h) => h.label);
      const chipLimit = hasNext ? SHARE_H - 220 : SHARE_H - 110;
      if (closedHabits.length && y + 40 < chipLimit) {
        y += 18;
        ctx.fillStyle = "#8ba3b8";
        ctx.font = "500 18px Sora, system-ui, sans-serif";
        const chips = `Morning · ${closedHabits.slice(0, 5).join(" · ")}`;
        ctx.fillText(ellipsize(ctx, chips, SHARE_W - 176), 88, y);
      }

      if (opts.next) {
        const boxY = SHARE_H - 196;
        ctx.fillStyle = "rgba(240,180,90,0.08)";
        ctx.beginPath();
        pathRoundRect(ctx, 88, boxY, SHARE_W - 176, 100, 16);
        ctx.fill();
        ctx.fillStyle = "#f0b45a";
        ctx.font = "600 15px Sora, system-ui, sans-serif";
        ctx.fillText("NEXT", 112, boxY + 34);
        ctx.fillStyle = "#d6e2ec";
        ctx.font = "500 22px Sora, system-ui, sans-serif";
        let ny = boxY + 64;
        for (const line of wrapLines(ctx, opts.next, SHARE_W - 240).slice(0, 2)) {
          ctx.fillText(line, 112, ny);
          ny += 28;
        }
      }

      void SHARE_H;
    },
  });
}
