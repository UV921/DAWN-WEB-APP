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

export type ShareTodoItem = { text: string; done: boolean };

export async function shareTodoListCard(opts: {
  listTitle: string;
  date: string;
  items: ShareTodoItem[];
}): Promise<"shared" | "downloaded"> {
  return exportShareCanvas({
    filename: `dawn-${slugShareName(opts.listTitle)}.png`,
    title: opts.listTitle,
    text: `${opts.listTitle} — from Dawn`,
    draw: (ctx) => {
      paintShareFrame(ctx);

      ctx.fillStyle = "#f0b45a";
      ctx.font = "600 72px Fraunces, Georgia, serif";
      const titleLines = wrapLines(ctx, opts.listTitle, SHARE_W - 176).slice(0, 2);
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

      const shown = opts.items.slice(0, 12);
      const extra = opts.items.length - shown.length;
      y += 110;

      for (const item of shown) {
        const boxY = y - 28;
        ctx.strokeStyle = item.done ? "#6fbf8a" : "rgba(240,180,90,0.7)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        pathRoundRect(ctx, 88, boxY, 36, 36, 8);
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
        const lines = wrapLines(ctx, item.text, SHARE_W - 260).slice(0, 2);
        let ly = y;
        for (const line of lines) {
          ctx.fillText(line, 148, ly);
          ly += 40;
        }
        y = ly + 28;
        if (y > SHARE_H - 160) break;
      }

      if (extra > 0) {
        ctx.fillStyle = "#8ba3b8";
        ctx.font = "500 26px Sora, system-ui, sans-serif";
        ctx.fillText(`+${extra} more`, 88, Math.min(y + 8, SHARE_H - 120));
      }
    },
  });
}
