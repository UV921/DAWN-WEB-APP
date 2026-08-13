"use client";

type Props = {
  earlyStreak: number;
  habitsDone: number;
  habitsTotal: number;
  xp: number;
  level: number;
  intoLevel: number;
  need: number;
  challenge: {
    active: boolean;
    day: number;
    total: number;
    daysLeft: number;
    ended: boolean;
  } | null;
  onStartChallenge: (days: number) => void;
};

export function TodayOverview({
  earlyStreak,
  habitsDone,
  habitsTotal,
  xp,
  level,
  intoLevel,
  need,
  challenge,
  onStartChallenge,
}: Props) {
  const active = Boolean(challenge?.active) && !challenge?.ended;
  const habitPct = habitsTotal
    ? Math.round((habitsDone / habitsTotal) * 100)
    : 0;
  const lvlPct = need ? Math.round((intoLevel / need) * 100) : 0;

  return (
    <section className="grid grid-cols-2 gap-2">
      <div className="ui-card ui-card-compact !text-left">
        <p className="ui-card-label">Streak</p>
        <p className="font-display mt-1 text-3xl text-[var(--color-leaf)]">
          {earlyStreak}
        </p>
        <p className="mt-1 text-xs text-[var(--color-mist)]">early wakes</p>
      </div>
      <div className="ui-card ui-card-compact !text-left">
        <p className="ui-card-label">Morning</p>
        <p className="font-display mt-1 text-3xl text-white">
          {habitsDone}/{habitsTotal || 1}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--color-dawn)]"
            style={{ width: `${habitPct}%` }}
          />
        </div>
      </div>
      <div className="ui-card ui-card-compact !text-left">
        <p className="ui-card-label">Run</p>
        {active ? (
          <>
            <p className="font-display mt-1 text-3xl text-white">
              {challenge?.day}/{challenge?.total}
            </p>
            <p className="mt-1 text-xs text-[var(--color-mist)]">
              {challenge?.daysLeft} left
            </p>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onStartChallenge(7)}
            className="mt-2 text-sm text-[var(--color-dawn)]"
          >
            Start 7-day run
          </button>
        )}
      </div>
      <div className="ui-card ui-card-compact !text-left">
        <p className="ui-card-label">Reward</p>
        <p className="font-display mt-1 text-3xl text-[var(--color-dawn)]">
          Lv {level}
        </p>
        <p className="mt-1 text-xs text-[var(--color-mist)]">
          {xp} XP · {Math.max(0, need - intoLevel)} to next
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--color-dawn)]"
            style={{ width: `${lvlPct}%` }}
          />
        </div>
      </div>
    </section>
  );
}
