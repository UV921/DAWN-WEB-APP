import {
  exportShareCanvas,
  formatShareDate,
  paintShareFrame,
  pathRoundRect,
  SHARE_W,
  slugShareName,
} from "@/lib/share-card";

export async function shareTodayCard(opts: {
  name?: string;
  date: string;
  earlyStreak: number;
  habitsDone: number;
  habitsTotal: number;
  level: number;
  xp: number;
  challenge?: { day: number; total: number } | null;
}): Promise<"shared" | "downloaded"> {
  const headline =
    opts.earlyStreak > 0
      ? `${opts.earlyStreak}-day early streak`
      : "Showing up today";

  return exportShareCanvas({
    filename: `dawn-today-${slugShareName(opts.date)}.png`,
    title: headline,
    text: `${headline} — from Dawn`,
    draw: (ctx) => {
      paintShareFrame(ctx);

      ctx.fillStyle = "#f0b45a";
      ctx.font = "600 68px Fraunces, Georgia, serif";
      ctx.fillText("Today", 88, 200);

      ctx.fillStyle = "#8ba3b8";
      ctx.font = "400 26px Sora, system-ui, sans-serif";
      const who = [opts.name, formatShareDate(opts.date)].filter(Boolean).join(" · ");
      ctx.fillText(who, 88, 248);
      ctx.fillStyle = "rgba(240,180,90,0.28)";
      ctx.fillRect(88, 272, 160, 3);

      ctx.fillStyle = "#ffffff";
      ctx.font = "600 52px Fraunces, Georgia, serif";
      ctx.fillText(headline, 88, 360);

      const tiles = [
        { label: "Early streak", value: `${opts.earlyStreak}d` },
        {
          label: "Morning",
          value: `${opts.habitsDone}/${opts.habitsTotal || 1}`,
        },
        { label: "Level", value: `Lv ${opts.level}` },
        { label: "XP", value: String(opts.xp) },
      ];
      if (opts.challenge) {
        tiles.push({
          label: "Run",
          value: `${opts.challenge.day}/${opts.challenge.total}`,
        });
      }

      tiles.slice(0, 4).forEach((tile, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 88 + col * 452;
        const y = 430 + row * 200;
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.beginPath();
        pathRoundRect(ctx, x, y, 430, 172, 22);
        ctx.fill();
        ctx.strokeStyle = "rgba(240,180,90,0.22)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#8ba3b8";
        ctx.font = "500 20px Sora, system-ui, sans-serif";
        ctx.fillText(tile.label.toUpperCase(), x + 28, y + 52);
        ctx.fillStyle = "#f0b45a";
        ctx.font = "600 64px Fraunces, Georgia, serif";
        ctx.fillText(tile.value, x + 28, y + 126);
      });

      const habitPct = opts.habitsTotal
        ? Math.min(100, Math.round((opts.habitsDone / opts.habitsTotal) * 100))
        : 0;
      ctx.fillStyle = "#8ba3b8";
      ctx.font = "500 22px Sora, system-ui, sans-serif";
      ctx.fillText("MORNING CLOSED", 88, 920);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      pathRoundRect(ctx, 88, 948, SHARE_W - 176, 18, 9);
      ctx.fill();
      ctx.fillStyle = "#f0b45a";
      ctx.beginPath();
      pathRoundRect(ctx, 88, 948, Math.max(12, ((SHARE_W - 176) * habitPct) / 100), 18, 9);
      ctx.fill();
      ctx.fillStyle = "#d6e2ec";
      ctx.font = "500 24px Sora, system-ui, sans-serif";
      ctx.fillText(`${habitPct}% of today’s habits`, 88, 1010);
    },
  });
}
