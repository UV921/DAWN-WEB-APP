"use client";

import { useSession } from "next-auth/react";
import { ShareCardButton } from "@/components/ShareCardButton";
import { shareTodayCard } from "@/lib/share-today-card";
import { formatLocalDate } from "@/lib/habits";

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
  const { data: session } = useSession();
  const active = Boolean(challenge?.active) && !challenge?.ended;
  const habitPct = habitsTotal
    ? Math.round((habitsDone / habitsTotal) * 100)
    : 0;
  const lvlPct = need ? Math.round((intoLevel / need) * 100) : 0;

  return (
    <section className="space-y-2">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="ui-card ui-card-compact !text-left">
          <p className="ui-card-label">Early streak</p>
          <p className="font-display mt-1 text-[1.65rem] leading-none text-[var(--color-leaf)] sm:text-3xl">
            {earlyStreak}
          </p>
          <p className="mt-1 text-xs text-[var(--color-mist)]">days in a row</p>
        </div>
        <div className="ui-card ui-card-compact !text-left">
          <p className="ui-card-label">Habits</p>
          <p className="font-display mt-1 text-[1.65rem] leading-none text-white sm:text-3xl">
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
          <p className="ui-card-label">Challenge</p>
          {active ? (
            <>
              <p className="font-display mt-1 text-[1.65rem] leading-none text-white sm:text-3xl">
                {challenge?.day}/{challenge?.total}
              </p>
              <p className="mt-1 text-xs text-[var(--color-mist)]">
                {challenge?.daysLeft} days left
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onStartChallenge(7)}
              className="mt-2 text-sm text-[var(--color-dawn)]"
            >
              Start 7 days
            </button>
          )}
        </div>
        <div className="ui-card ui-card-compact !text-left">
          <p className="ui-card-label">Level</p>
          <p className="font-display mt-1 text-[1.65rem] leading-none text-[var(--color-dawn)] sm:text-3xl">
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
      </div>
      <ShareCardButton
        label="Share today"
        make={() =>
          shareTodayCard({
            name: session?.user?.name || undefined,
            date: formatLocalDate(new Date()),
            earlyStreak,
            habitsDone,
            habitsTotal,
            level,
            xp,
            challenge: active && challenge
              ? { day: challenge.day, total: challenge.total }
              : null,
          })
        }
      />
    </section>
  );
}
