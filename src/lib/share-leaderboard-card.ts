import {
  exportShareCanvas,
  formatShareDate,
  paintShareFrame,
  pathRoundRect,
  SHARE_W,
  slugShareName,
  wrapLines,
} from "@/lib/share-card";

export type ShareBoardRow = {
  rank: number;
  name: string;
  scoreLabel: string;
  isMe?: boolean;
};

export async function shareLeaderboardCard(opts: {
  metricLabel: string;
  scopeLabel: string;
  date: string;
  me?: { rank: number; name: string; scoreLabel: string } | null;
  rows: ShareBoardRow[];
}): Promise<"shared" | "downloaded"> {
  return exportShareCanvas({
    filename: `dawn-board-${slugShareName(opts.metricLabel)}.png`,
    title: `${opts.metricLabel} · Dawn`,
    text: opts.me
      ? `I'm #${opts.me.rank} on ${opts.metricLabel} — from Dawn`
      : `${opts.metricLabel} board — from Dawn`,
    draw: (ctx) => {
      paintShareFrame(ctx);

      ctx.fillStyle = "#f0b45a";
      ctx.font = "600 58px Fraunces, Georgia, serif";
      let y = 196;
      for (const line of wrapLines(ctx, opts.metricLabel, SHARE_W - 176).slice(0, 2)) {
        ctx.fillText(line, 88, y);
        y += 68;
      }

      ctx.fillStyle = "#8ba3b8";
      ctx.font = "400 26px Sora, system-ui, sans-serif";
      ctx.fillText(
        `${opts.scopeLabel} · ${opts.date ? formatShareDate(opts.date) : "today"}`,
        88,
        y + 4
      );
      y += 36;
      ctx.fillStyle = "rgba(240,180,90,0.28)";
      ctx.fillRect(88, y, 160, 3);
      y += 40;

      if (opts.me) {
        ctx.fillStyle = "rgba(240,180,90,0.1)";
        ctx.beginPath();
        pathRoundRect(ctx, 88, y, SHARE_W - 176, 150, 22);
        ctx.fill();
        ctx.strokeStyle = "rgba(240,180,90,0.4)";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#f0b45a";
        ctx.font = "600 20px Sora, system-ui, sans-serif";
        ctx.fillText("YOUR PLACE", 118, y + 42);
        ctx.fillStyle = "#ffffff";
        ctx.font = "600 64px Fraunces, Georgia, serif";
        ctx.fillText(`#${opts.me.rank}`, 118, y + 112);
        ctx.fillStyle = "#f0b45a";
        ctx.font = "600 40px Fraunces, Georgia, serif";
        const score = opts.me.scoreLabel;
        ctx.fillText(score, SHARE_W - 118 - ctx.measureText(score).width, y + 108);
        y += 186;
      }

      ctx.fillStyle = "#f0b45a";
      ctx.font = "600 22px Sora, system-ui, sans-serif";
      ctx.fillText("BOARD", 88, y);
      y += 28;

      const shown = opts.rows.slice(0, 8);
      for (const row of shown) {
        if (y > 1180) break;
        if (row.isMe) {
          ctx.fillStyle = "rgba(240,180,90,0.12)";
          ctx.beginPath();
          pathRoundRect(ctx, 88, y, SHARE_W - 176, 72, 16);
          ctx.fill();
        }

        ctx.fillStyle = row.rank <= 3 ? "#071018" : "#d6e2ec";
        if (row.rank <= 3) {
          ctx.fillStyle = "#f0b45a";
          ctx.beginPath();
          ctx.arc(128, y + 36, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#071018";
          ctx.font = "700 20px Sora, system-ui, sans-serif";
          const n = String(row.rank);
          ctx.fillText(n, 128 - ctx.measureText(n).width / 2, y + 43);
        } else {
          ctx.fillStyle = "#8ba3b8";
          ctx.font = "600 22px Sora, system-ui, sans-serif";
          const n = String(row.rank);
          ctx.fillText(n, 128 - ctx.measureText(n).width / 2, y + 43);
        }

        ctx.fillStyle = "#ffffff";
        ctx.font = "500 28px Sora, system-ui, sans-serif";
        const name = (row.isMe ? `${row.name} (you)` : row.name).slice(0, 22);
        ctx.fillText(name, 172, y + 44);

        ctx.fillStyle = "#f0b45a";
        ctx.font = "600 28px Fraunces, Georgia, serif";
        ctx.fillText(
          row.scoreLabel,
          SHARE_W - 118 - ctx.measureText(row.scoreLabel).width,
          y + 44
        );
        y += 80;
      }
    },
  });
}
