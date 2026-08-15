import {
  exportShareCanvas,
  formatShareDate,
  paintShareFrame,
  pathRoundRect,
  SHARE_W,
  slugShareName,
} from "@/lib/share-card";

export async function shareStudyCard(opts: {
  name?: string;
  date: string;
  headline: string;
  today: string;
  week: string;
  month: string;
  year: string;
  all: string;
  live?: boolean;
  streak?: number;
  bars: { date: string; minutes: number; label: string }[];
}): Promise<"shared" | "downloaded"> {
  return exportShareCanvas({
    filename: `dawn-study-${slugShareName(opts.date)}.png`,
    title: "Study hours · Dawn",
    text: `${opts.headline} — from Dawn`,
    draw: (ctx) => {
      paintShareFrame(ctx);

      ctx.fillStyle = "#f0b45a";
      ctx.font = "600 68px Fraunces, Georgia, serif";
      ctx.fillText("Study hours", 88, 200);

      ctx.fillStyle = "#8ba3b8";
      ctx.font = "400 26px Sora, system-ui, sans-serif";
      const who = [opts.name, formatShareDate(opts.date)].filter(Boolean).join(" · ");
      ctx.fillText(who, 88, 248);
      ctx.fillStyle = "rgba(240,180,90,0.28)";
      ctx.fillRect(88, 272, 160, 3);

      ctx.fillStyle = "#d6e2ec";
      ctx.font = "500 32px Sora, system-ui, sans-serif";
      ctx.fillText(opts.headline.slice(0, 64), 88, 330);

      const tiles = [
        { label: "Today", value: opts.today },
        { label: "Week", value: opts.week },
        { label: "Month", value: opts.month },
        { label: "Year", value: opts.year },
        { label: "All time", value: opts.all },
      ];
      tiles.forEach((tile, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = 88 + col * 300;
        const y = 380 + row * 150;
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.beginPath();
        pathRoundRect(ctx, x, y, 280, 128, 18);
        ctx.fill();
        ctx.strokeStyle = "rgba(240,180,90,0.2)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#8ba3b8";
        ctx.font = "500 18px Sora, system-ui, sans-serif";
        ctx.fillText(tile.label.toUpperCase(), x + 20, y + 40);
        ctx.fillStyle = "#f0b45a";
        ctx.font = "600 40px Fraunces, Georgia, serif";
        ctx.fillText(tile.value, x + 20, y + 92);
        if (tile.label === "Today" && opts.live) {
          ctx.fillStyle = "#6fbf8a";
          ctx.font = "600 16px Sora, system-ui, sans-serif";
          ctx.fillText("LIVE", x + 200, y + 40);
        }
      });

      if (opts.streak && opts.streak > 0) {
        ctx.fillStyle = "#d6e2ec";
        ctx.font = "500 26px Sora, system-ui, sans-serif";
        ctx.fillText(
          `${opts.streak} day${opts.streak === 1 ? "" : "s"} with study in a row`,
          88,
          720
        );
      }

      const bars = opts.bars.slice(-14);
      if (bars.length) {
        const max = Math.max(1, ...bars.map((b) => b.minutes));
        const baseY = 1080;
        const barArea = 220;
        const slot = (SHARE_W - 176) / bars.length;
        ctx.fillStyle = "#f0b45a";
        ctx.font = "600 22px Sora, system-ui, sans-serif";
        ctx.fillText("RECENT DAYS", 88, 780);

        bars.forEach((b, i) => {
          const h = Math.max(6, Math.round((b.minutes / max) * barArea));
          const x = 88 + i * slot + 6;
          const w = Math.max(10, slot - 14);
          ctx.fillStyle = b.minutes > 0 ? "#f0b45a" : "rgba(255,255,255,0.08)";
          ctx.beginPath();
          pathRoundRect(ctx, x, baseY - h, w, h, 6);
          ctx.fill();
        });
      }
    },
  });
}
