"use client";

import Link from "next/link";
import {
  completedCount,
  isHabitDone,
  type HabitDef,
} from "@/lib/habits";
import { formatStudyDuration } from "@/lib/study-time";
import type { CircleBoardSort } from "@/lib/circle-board";

type MemberUser = {
  id: string;
  name: string | null;
  image: string | null;
  discordId?: string | null;
};

type Log = {
  date?: string;
  bedtime?: string | null;
  checks?: Record<string, boolean>;
  sleepEarly?: boolean;
  noPhone?: boolean;
  wakeEarly?: boolean;
  gym?: boolean;
  reading?: boolean;
  quran?: boolean;
  wakeTime: string | null;
};

export type BoardMember = {
  user: MemberUser;
  log: Log | null;
  stats: {
    checkedIn: boolean;
    wakeOnTime: boolean;
    earlyStreak: number;
    openStreak: number;
    level: number;
    xp: number;
    wakeGoal: string;
    wakeDays7: number;
    needsNudge: boolean;
    habitPct: number;
    todayHabits: number;
    studyWeek: number;
    studyTotal: number;
    consistency: number;
    combined: number;
    consistencyStreak?: number;
  };
  ranks?: {
    today: number;
    habits: number;
    study: number;
    consistency: number;
    combined: number;
  };
};

const SORTS: { id: CircleBoardSort; label: string }[] = [
  { id: "combined", label: "Habits + study" },
  { id: "habits", label: "Habit consistency" },
  { id: "study", label: "Study hours" },
  { id: "consistency", label: "On-time wakes" },
  { id: "today", label: "Today" },
];

function scoreLabel(sort: CircleBoardSort, row: BoardMember) {
  if (sort === "study") return formatStudyDuration(row.stats.studyWeek);
  if (sort === "habits") return `${row.stats.habitPct}%`;
  if (sort === "consistency") return `${row.stats.consistency}%`;
  if (sort === "combined") return String(row.stats.combined);
  if (row.stats.wakeOnTime) return "On time";
  if (row.stats.checkedIn) return "Up";
  return "Not yet";
}

function rankOf(sort: CircleBoardSort, row: BoardMember) {
  return row.ranks?.[sort] || 999;
}

export function CircleRankBoard({
  members,
  sort,
  onSort,
  myHabits,
  meId,
  isOwner,
  busy,
  circleId,
  onNudge,
  onRemove,
}: {
  members: BoardMember[];
  sort: CircleBoardSort;
  onSort: (s: CircleBoardSort) => void;
  myHabits: HabitDef[];
  meId: string;
  isOwner: boolean;
  busy: boolean;
  circleId: string;
  onNudge: (userId: string, name: string | null) => void;
  onRemove: (userId: string, name: string | null) => void;
}) {
  const habitKeys = myHabits.map((h) => h.key);
  const totalHabits = Math.max(habitKeys.length, 1);
  const sorted = [...members].sort((a, b) => rankOf(sort, a) - rankOf(sort, b));
  const me = sorted.find((r) => r.user.id === meId);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-xl text-white">Rank board</h3>
        <Link
          href={`/leaderboard?scope=circle&circleId=${encodeURIComponent(circleId)}`}
          className="text-xs text-[var(--color-dawn)] underline-offset-2 hover:underline"
        >
          Full leaderboard
        </Link>
      </div>
      <p className="mt-1 text-xs text-[var(--color-mist)]">
        Ranked by habit consistency (7-day %) and study hours from Discord
        voice rooms. Combined is a 50/50 mix.
      </p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {SORTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSort(s.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${
              sort === s.id
                ? "border border-[var(--color-dawn)] bg-[var(--color-dawn)]/15 text-[var(--color-dawn)]"
                : "border border-white/10 text-[var(--color-mist)]"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {me ? (
        <p className="steel-plate-sm mt-4 rounded-xl bg-[var(--color-dawn)]/10 px-4 py-3 text-sm text-white">
          You’re #{rankOf(sort, me)} · {scoreLabel(sort, me)}
          {" · "}
          {me.stats.habitPct}% habits · {formatStudyDuration(me.stats.studyWeek)}{" "}
          studied this week
        </p>
      ) : null}

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {sorted.map((row) => {
          const score = row.log
            ? completedCount(
                {
                  date: row.log.date || "",
                  wakeTime: row.log.wakeTime,
                  bedtime: row.log.bedtime ?? null,
                  checks: row.log.checks,
                  sleepEarly: row.log.sleepEarly,
                  noPhone: row.log.noPhone,
                  wakeEarly: row.log.wakeEarly,
                  gym: row.log.gym,
                  reading: row.log.reading,
                  quran: row.log.quran,
                },
                habitKeys
              )
            : 0;
          const isMe = row.user.id === meId;
          const place = rankOf(sort, row);
          return (
            <li
              key={row.user.id}
              className={`steel-plate rounded-2xl p-4 ${
                isMe
                  ? "bg-[var(--color-dawn)]/[0.08]"
                  : row.stats.checkedIn
                    ? "bg-white/[0.04]"
                    : "bg-white/[0.03]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      place <= 3
                        ? "bg-[var(--color-dawn)] text-[var(--color-night)]"
                        : "bg-white/10 text-white"
                    }`}
                  >
                    {place}
                  </span>
                  {row.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.user.image}
                      alt=""
                      className="h-10 w-10 rounded-full border border-white/20"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm text-white">
                      {(row.user.name || "?").slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">
                      {row.user.name || "Member"}
                      {isMe ? " · you" : ""}
                    </p>
                    <p className="text-xs text-[var(--color-mist)]">
                      Lv {row.stats.level} · {scoreLabel(sort, row)}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ${
                    row.stats.wakeOnTime
                      ? "bg-[var(--color-leaf)]/20 text-[var(--color-leaf)]"
                      : row.stats.checkedIn
                        ? "bg-[var(--color-dawn)]/20 text-[var(--color-dawn)]"
                        : "bg-white/10 text-[var(--color-mist)]"
                  }`}
                >
                  {row.stats.wakeOnTime
                    ? "On time"
                    : row.stats.checkedIn
                      ? "Up"
                      : "Not yet"}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-black/20 px-2 py-2">
                  <p className="font-display text-lg text-[var(--color-dawn)]">
                    {row.stats.habitPct}%
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--color-mist)]">
                    Habits 7d
                  </p>
                </div>
                <div className="rounded-lg bg-black/20 px-2 py-2">
                  <p className="font-display text-lg text-[var(--color-dawn)]">
                    {formatStudyDuration(row.stats.studyWeek)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--color-mist)]">
                    Study wk
                  </p>
                </div>
                <div className="rounded-lg bg-black/20 px-2 py-2">
                  <p className="font-display text-lg text-[var(--color-dawn)]">
                    {row.stats.combined}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--color-mist)]">
                    Combined
                  </p>
                </div>
              </div>

              <p className="mt-3 text-sm text-[var(--color-mist)]">
                {row.log
                  ? `${score}/${totalHabits} habits today · woke ${row.log.wakeTime || "—"} · goal ${row.stats.wakeGoal}`
                  : `Not checked in · wake goal ${row.stats.wakeGoal}`}
              </p>
              <p className="mt-1 text-xs text-[var(--color-mist)]">
                Early wakes {row.stats.wakeDays7}/7 · all-time study{" "}
                {formatStudyDuration(row.stats.studyTotal)}
              </p>

              {row.log ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {myHabits.map((h) => (
                    <span
                      key={h.key}
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        isHabitDone(row.log!, h.key)
                          ? "bg-[var(--color-dawn)]/20 text-[var(--color-dawn)]"
                          : "bg-white/5 text-white/35"
                      }`}
                    >
                      {h.label}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {!isMe && row.stats.needsNudge ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onNudge(row.user.id, row.user.name)}
                    className="ui-btn ui-btn-primary ui-btn-sm"
                  >
                    Nudge on Discord
                  </button>
                ) : null}
                {isOwner && !isMe ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onRemove(row.user.id, row.user.name)}
                    className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[var(--color-mist)]"
                  >
                    Remove
                  </button>
                ) : null}
                {!row.user.discordId && !isMe ? (
                  <span className="text-[11px] text-[var(--color-mist)]">
                    No Discord linked — nudge won’t work yet
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
