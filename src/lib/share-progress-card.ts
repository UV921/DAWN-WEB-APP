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

export type ShareProgressHabit = { label: string; pct: number };
export type ShareProgressDay = { label: string; habitPct: number; logged: boolean };

export async function shareProgressCard(opts: {
  name?: string;
  date: string;
  headline: string;
  habitPct7: number;
  taskPct7: number;
  fullHabitDays7: number;
  studyWeekLabel?: string;
  habits: ShareProgressHabit[];
  last7: ShareProgressDay[];
}): Promise<"shared" | "downloaded"> {
  return exportShareCanvas({
    filename: `dawn-progress-${slugShareName(opts.date)}.png`,
    title: "My week on Dawn",
    text: `${opts.headline} — from Dawn`,
    draw: (ctx) => {
      paintShareFrame(ctx);

      ctx.fillStyle = "#f0b45a";
      ctx.font = "600 68px Fraunces, Georgia, serif";
      ctx.fillText("This week", 88, 200);

      ctx.fillStyle = "#8ba3b8";
      ctx.font = "400 26px Sora, system-ui, sans-serif";
      const who = [opts.name, formatShareDate(opts.date)].filter(Boolean).join(" · ");
      ctx.fillText(who, 88, 248);

      ctx.fillStyle = "rgba(240,180,90,0.28)";
      ctx.fillRect(88, 272, 160, 3);

      ctx.fillStyle = "#d6e2ec";
      ctx.font = "500 32px Sora, system-ui, sans-serif";
      let y = 330;
      for (const line of wrapLines(ctx, opts.headline, SHARE_W - 176).slice(0, 3)) {
        ctx.fillText(line, 88, y);
        y += 42;
      }

      const tiles = [
        { label: "Habits", value: `${opts.habitPct7}%` },
        { label: "Tasks", value: `${opts.taskPct7}%` },
        { label: "Full mornings", value: `${opts.fullHabitDays7}/7` },
        { label: "Study", value: opts.studyWeekLabel || "0m" },
      ];
      y += 28;
      const tileW = 210;
      const gap = 18;
      tiles.forEach((tile, i) => {
        const x = 88 + i * (tileW + gap);
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.beginPath();
        pathRoundRect(ctx, x, y, tileW, 118, 18);
        ctx.fill();
        ctx.strokeStyle = "rgba(240,180,90,0.22)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#8ba3b8";
        ctx.font = "500 18px Sora, system-ui, sans-serif";
        ctx.fillText(tile.label.toUpperCase(), x + 18, y + 38);
        ctx.fillStyle = "#f0b45a";
        ctx.font = "600 40px Fraunces, Georgia, serif";
        ctx.fillText(tile.value, x + 18, y + 88);
      });

      y += 168;
      ctx.fillStyle = "#f0b45a";
      ctx.font = "600 22px Sora, system-ui, sans-serif";
      ctx.fillText("HABITS", 88, y);
      y += 36;

      for (const h of opts.habits.slice(0, 5)) {
        ctx.fillStyle = "#d6e2ec";
        ctx.font = "500 26px Sora, system-ui, sans-serif";
        const label = h.label.slice(0, 22);
        ctx.fillText(label, 88, y);
        ctx.fillStyle = "#8ba3b8";
        ctx.font = "500 24px Sora, system-ui, sans-serif";
        ctx.fillText(`${h.pct}%`, SHARE_W - 88 - ctx.measureText(`${h.pct}%`).width, y);

        const barY = y + 16;
        const barW = SHARE_W - 176;
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.beginPath();
        pathRoundRect(ctx, 88, barY, barW, 10, 5);
        ctx.fill();
        ctx.fillStyle = "#f0b45a";
        ctx.beginPath();
        pathRoundRect(ctx, 88, barY, Math.max(8, (barW * h.pct) / 100), 10, 5);
        ctx.fill();
        y += 62;
      }

      if (opts.last7.length) {
        y += 12;
        ctx.fillStyle = "#f0b45a";
        ctx.font = "600 22px Sora, system-ui, sans-serif";
        ctx.fillText("LAST 7 DAYS", 88, y);
        y += 50;
        const cell = 92;
        opts.last7.forEach((d, i) => {
          const x = 88 + i * (cell + 18);
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
          ctx.arc(x + 28, y, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#8ba3b8";
          ctx.font = "500 20px Sora, system-ui, sans-serif";
          ctx.fillText(d.label, x + 28 - ctx.measureText(d.label).width / 2, y + 52);
        });
      }

      void SHARE_H;
    },
  });
}
