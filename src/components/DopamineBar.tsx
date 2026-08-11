"use client";

type Props = {
  xp: number;
  level: number;
  progress: number;
  intoLevel: number;
  need: number;
  identityLine?: string;
  whyLine?: string;
  focusLabel?: string;
  earlyStreak: number;
  totalEarlyWakes: number;
};

export function DopamineBar({
  xp,
  level,
  progress,
  intoLevel,
  need,
  identityLine,
  whyLine,
  focusLabel,
  earlyStreak,
  totalEarlyWakes,
}: Props) {
  return (
    <section className="animate-rise mb-8 border-b border-white/10 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-dawn)]">
            Progress
          </p>
          {identityLine ? (
            <p className="font-display mt-2 text-2xl text-white">
              I am someone who {identityLine}
            </p>
          ) : (
            <p className="font-display mt-2 text-2xl text-white">
              Show up in the window
            </p>
          )}
          {whyLine ? (
            <p className="mt-1 text-sm text-[var(--color-mist)]">{whyLine}</p>
          ) : null}
          {focusLabel ? (
            <p className="mt-2 text-sm text-[var(--color-leaf)]">
              Focus · {focusLabel}
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="font-display text-3xl text-[var(--color-dawn)]">
            Lv {level}
          </p>
          <p className="text-xs text-[var(--color-mist)]">{xp} XP</p>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs text-[var(--color-mist)]">
          <span>
            {intoLevel}/{need} to next level
          </span>
          <span>
            {earlyStreak}d streak · {totalEarlyWakes} early wakes
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/30">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--color-ember)] to-[var(--color-dawn)] transition-all duration-700"
            style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }}
          />
        </div>
      </div>
    </section>
  );
}
