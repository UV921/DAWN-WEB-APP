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
import type { ReportRange } from "@/lib/progress-brief";

export type ShareProgressHabit = {
  label: string;
  pct: number;
  hits?: number;
  sample?: number;
};
export type ShareProgressDay = {
  label: string;
  habitPct: number;
  logged: boolean;
};

function rangeTitle(range: ReportRange) {
  if (range === "today") return "Today";
  if (range === "week") return "Last 7 days";
  if (range === "month") return "Last 30 days";
  return "This year";
}

export async function shareProgressCard(opts: {
  name?: string;
  date: string;
  range: ReportRange;
  kicker: string;
  headline: string;
  next?: string;
  wakeValue: string;
  habitValue: string;
  taskValue: string;
  studyValue: string;
  habits: ShareProgressHabit[];
  days: ShareProgressDay[];
}): Promise<"shared" | "downloaded"> {
  const window = rangeTitle(opts.range);
  return exportShareCanvas({
    filename: `dawn-progress-${opts.range}-${slugShareName(opts.date)}.png`,
    title: `My ${window.toLowerCase()} on Dawn`,
    text: `${opts.headline} — from Dawn`,
    draw: (ctx) => {
      paintShareFrame(ctx);

      ctx.fillStyle = "#f0b45a";
      ctx.font = "600 64px Fraunces, Georgia, serif";
      ctx.fillText(window, 88, 196);

      ctx.fillStyle = "#8ba3b8";
      ctx.font = "400 24px Sora, system-ui, sans-serif";
      const who = [opts.name, formatShareDate(opts.date), opts.kicker]
        .filter(Boolean)
        .join(" · ");
      ctx.fillText(who, 88, 242);

      ctx.fillStyle = "rgba(240,180,90,0.28)";
      ctx.fillRect(88, 266, 160, 3);

      ctx.fillStyle = "#d6e2ec";
      ctx.font = "500 30px Sora, system-ui, sans-serif";
      let y = 322;
      for (const line of wrapLines(ctx, opts.headline, SHARE_W - 176).slice(0, 3)) {
        ctx.fillText(line, 88, y);
        y += 40;
      }

      const tiles = [
        { label: "Wake", value: opts.wakeValue },
        { label: "Habits", value: opts.habitValue },
        { label: "Tasks", value: opts.taskValue },
        { label: "Study", value: opts.studyValue },
      ];
      y += 24;
      const tileW = 210;
      const gap = 18;
      tiles.forEach((tile, i) => {
        const x = 88 + i * (tileW + gap);
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.beginPath();
        pathRoundRect(ctx, x, y, tileW, 112, 18);
        ctx.fill();
        ctx.strokeStyle = "rgba(240,180,90,0.22)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#8ba3b8";
        ctx.font = "500 16px Sora, system-ui, sans-serif";
        ctx.fillText(tile.label.toUpperCase(), x + 18, y + 36);
        ctx.fillStyle = "#f0b45a";
        ctx.font = "600 36px Fraunces, Georgia, serif";
        const value = tile.value.slice(0, 12);
        ctx.fillText(value, x + 18, y + 84);
      });

      y += 156;
      ctx.fillStyle = "#f0b45a";
      ctx.font = "600 20px Sora, system-ui, sans-serif";
      ctx.fillText("EACH HABIT", 88, y);
      y += 34;

      const habitRows = opts.habits.slice(0, 5);
      for (const h of habitRows) {
        ctx.fillStyle = "#d6e2ec";
        ctx.font = "500 24px Sora, system-ui, sans-serif";
        ctx.fillText(h.label.slice(0, 22), 88, y);
        const right =
          h.sample != null
            ? `${h.hits ?? 0}/${h.sample} · ${h.pct}%`
            : `${h.pct}%`;
        ctx.fillStyle = "#8ba3b8";
        ctx.font = "500 22px Sora, system-ui, sans-serif";
        ctx.fillText(right, SHARE_W - 88 - ctx.measureText(right).width, y);

        const barY = y + 14;
        const barW = SHARE_W - 176;
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.beginPath();
        pathRoundRect(ctx, 88, barY, barW, 10, 5);
        ctx.fill();
        ctx.fillStyle = "#f0b45a";
        ctx.beginPath();
        pathRoundRect(ctx, 88, barY, Math.max(8, (barW * h.pct) / 100), 10, 5);
        ctx.fill();
        y += 56;
      }

      if (opts.days.length) {
        y += 10;
        ctx.fillStyle = "#f0b45a";
        ctx.font = "600 20px Sora, system-ui, sans-serif";
        ctx.fillText("CONSISTENCY", 88, y);
        y += 48;
        const count = Math.min(opts.days.length, 14);
        const cell = (SHARE_W - 176 - (count - 1) * 12) / count;
        opts.days.slice(-count).forEach((d, i) => {
          const x = 88 + i * (cell + 12);
          const fill =
            !d.logged
              ? "rgba(255,255,255,0.08)"
              : d.habitPct >= 80
                ? "#f0b45a"
                : d.habitPct >= 40
                  ? "rgba(240,180,90,0.45)"
                  : "rgba(255,255,255,0.16)";
          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.arc(x + cell / 2, y, Math.min(16, cell / 2 - 2), 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#8ba3b8";
          ctx.font = "500 16px Sora, system-ui, sans-serif";
          const lab = d.label.slice(0, 2);
          ctx.fillText(
            lab,
            x + cell / 2 - ctx.measureText(lab).width / 2,
            y + 36
          );
        });
        y += 64;
      }

      if (opts.next) {
        y = Math.min(y + 16, SHARE_H - 220);
        ctx.fillStyle = "rgba(240,180,90,0.08)";
        ctx.beginPath();
        pathRoundRect(ctx, 88, y, SHARE_W - 176, 110, 16);
        ctx.fill();
        ctx.fillStyle = "#f0b45a";
        ctx.font = "600 16px Sora, system-ui, sans-serif";
        ctx.fillText("NEXT", 112, y + 36);
        ctx.fillStyle = "#d6e2ec";
        ctx.font = "500 24px Sora, system-ui, sans-serif";
        let ny = y + 70;
        for (const line of wrapLines(ctx, opts.next, SHARE_W - 240).slice(0, 2)) {
          ctx.fillText(line, 112, ny);
          ny += 32;
        }
      }

      void SHARE_H;
    },
  });
}
