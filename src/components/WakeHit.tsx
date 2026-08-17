"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  xpGained: number;
  labels: string[];
  level: number;
  progress: number;
  streak: number;
  celebrate: "big" | "chill";
  onClose: () => void;
};

/** Dopamine celebration when you wake early / earn XP */
export function WakeHit({
  open,
  title,
  subtitle,
  xpGained,
  labels,
  level,
  progress,
  streak,
  celebrate,
  onClose,
}: Props) {
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (!open) return;
    setBurst((b) => b + 1);
    if (celebrate === "big") {
      playChime();
    }
    const t = window.setTimeout(onClose, celebrate === "big" ? 4200 : 2200);
    return () => window.clearTimeout(t);
  }, [open, celebrate, onClose]);

  const particles = useMemo(
    () =>
      Array.from({ length: celebrate === "big" ? 28 : 10 }, (_, i) => ({
        id: `${burst}-${i}`,
        left: `${8 + ((i * 37) % 84)}%`,
        delay: `${(i % 8) * 0.05}s`,
        hue: i % 3 === 0 ? "dawn" : i % 3 === 1 ? "ember" : "leaf",
      })),
    [burst, celebrate]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-6 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
    >
      {celebrate === "big" &&
        particles.map((p) => (
          <span
            key={p.id}
            className={`pointer-events-none absolute top-[40%] h-2 w-2 rounded-full wake-particle wake-particle-${p.hue}`}
            style={{ left: p.left, animationDelay: p.delay }}
          />
        ))}
      <div
        className="animate-rise relative w-full max-w-sm rounded-3xl border border-[var(--color-dawn)]/40 bg-[#0d131a] p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="ui-kicker">Dopamine hit</p>
        <h2 className="ui-title mt-3 text-[1.85rem]">{title}</h2>
        {subtitle && (
          <p className="mt-2 text-sm text-[var(--color-mist)]">{subtitle}</p>
        )}
        <p className="font-display mt-6 text-4xl text-[var(--color-dawn)]">
          +{xpGained} XP
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {labels.map((l) => (
            <span
              key={l}
              className="rounded-full bg-[var(--color-dawn)]/15 px-2.5 py-1 text-xs text-[var(--color-dawn)]"
            >
              {l}
            </span>
          ))}
        </div>
        <div className="mt-6">
          <div className="flex justify-between text-xs text-[var(--color-mist)]">
            <span>Level {level}</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[var(--color-dawn)] transition-all duration-700"
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>
        </div>
        {streak > 0 && (
          <p className="mt-4 text-sm text-[var(--color-leaf)]">
            Early streak · {streak} day{streak === 1 ? "" : "s"} 🔥
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="ui-btn ui-btn-primary mt-6"
        >
          Keep going
        </button>
      </div>
    </div>
  );
}

function playChime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02 + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45 + i * 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + 0.55 + i * 0.1);
    });
    window.setTimeout(() => void ctx.close(), 1200);
  } catch {
    /* ignore */
  }
}
