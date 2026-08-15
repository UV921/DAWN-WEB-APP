"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AppNav } from "@/components/AppNav";
import { IconChevronRight } from "@/components/icons";
import { formatStudyDuration } from "@/lib/study-time";

type Metric =
  | "earlyStreak"
  | "openStreak"
  | "xp"
  | "consistency"
  | "totalEarly"
  | "studyWeek"
  | "studyTotal"
  | "habits";

type Row = {
  rank: number;
  userId: string;
  name: string;
  image: string | null;
  hasDiscord?: boolean;
  level: number;
  wakeGoal: string;
  upToday: boolean;
  onTimeToday: boolean;
  earlyStreak: number;
  openStreak: number;
  xp: number;
  totalEarlyWakes: number;
  wakeOnTime7: number;
  consistency: number;
  studyWeek?: number;
  studyTotal?: number;
  habits?: number;
  score: number;
  isMe: boolean;
};

type CircleOpt = { id: string; name: string };

const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: "studyWeek", label: "Study · week", unit: "studied" },
  { id: "studyTotal", label: "Study · all time", unit: "studied" },
  { id: "habits", label: "Habits · 7d", unit: "%" },
  { id: "earlyStreak", label: "Early streak", unit: "days" },
  { id: "openStreak", label: "Open streak", unit: "days" },
  { id: "consistency", label: "7-day on-time", unit: "%" },
  { id: "xp", label: "XP", unit: "xp" },
  { id: "totalEarly", label: "Lifetime early", unit: "wakes" },
];

function medal(rank: number) {
  if (rank === 1) return "1";
  if (rank === 2) return "2";
  if (rank === 3) return "3";
  return String(rank);
}

function formatScore(metric: Metric, score: number) {
  if (metric === "studyWeek" || metric === "studyTotal") {
    return formatStudyDuration(score);
  }
  if (metric === "consistency" || metric === "habits") {
    return `${score}%`;
  }
  return String(score);
}

export function LeaderboardClient() {
  const { data: session } = useSession();
  const [metric, setMetric] = useState<Metric>("studyWeek");
  const [scope, setScope] = useState<"discord" | "global" | "circle">("discord");
  const [circleId, setCircleId] = useState("");
  const [circles, setCircles] = useState<CircleOpt[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [me, setMe] = useState<Row | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [emptyReason, setEmptyReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState("");
  const [hasDiscord, setHasDiscord] = useState(false);
  const [discordBoardName, setDiscordBoardName] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ metric, scope });
    if (scope === "circle" && circleId) q.set("circleId", circleId);
    const res = await fetch(`/api/leaderboard?${q}`);
    setLoading(false);
    if (!res.ok) return;
    const data = await res.json();
    setRows(data.rows || []);
    setMe(data.me || null);
    setCircles(data.circles || []);
    setLabels(data.labels || {});
    setToday(data.today || "");
    setEmptyReason(data.emptyReason || "");
    setHasDiscord(Boolean(data.hasDiscord));
    setDiscordBoardName(data.discordBoardName || null);
    if (data.circleId && !circleId) setCircleId(data.circleId);
  }, [metric, scope, circleId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!session?.user) {
    return (
      <main className="dawn-bg min-h-screen">
        <div className="app-shell mx-auto max-w-3xl">
          <AppNav active="leaderboard" />
          <p className="mt-10 text-sm text-[var(--color-mist)]">Loading board…</p>
        </div>
      </main>
    );
  }

  const metricMeta = METRICS.find((m) => m.id === metric)!;
  const top = rows.slice(0, 3);

  return (
    <main className="dawn-bg noise relative min-h-screen">
      <div className="app-shell relative z-10 mx-auto max-w-3xl">
        <AppNav active="leaderboard" />
        <div className="mt-6 animate-rise sm:mt-10">
          <p className="ui-kicker">Compete</p>
          <h1 className="ui-title mt-2">Who showed up</h1>
          <p className="ui-sub mt-3">
            {scope === "discord"
              ? "People on your Discord server who logged into Dawn — ranked by study hours, habits, and streaks. Time only counts after they sign in with Discord."
              : scope === "circle"
                ? "Your friend circle only. Invite people from Friends if this looks empty."
                : "Everyone on Dawn — ranked by study, habits, and streaks."}{" "}
            {today ? `Updated for ${today}.` : ""}
          </p>

          {scope === "discord" && discordBoardName ? (
            <p className="mt-2 text-sm text-[var(--color-leaf)]">
              Board · {discordBoardName} · {rows.length} people
            </p>
          ) : null}

          {!hasDiscord ? (
            <a
              href="/settings?tab=discord"
              className="mt-4 inline-flex items-center gap-1 rounded-2xl border border-[var(--color-dawn)]/30 bg-[var(--color-dawn)]/10 px-4 py-3 text-sm text-[var(--color-cloud)]"
            >
              Link Discord in Settings so you appear on the server board
              <IconChevronRight size={16} />
            </a>
          ) : null}

          {/* Scope */}
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setScope("discord")}
              className={`rounded-full px-4 py-2 text-sm ${
                scope === "discord"
                  ? "bg-[var(--color-dawn)] font-semibold text-[var(--color-night)]"
                  : "border border-white/15 text-[var(--color-mist)]"
              }`}
            >
              Discord circle
            </button>
            <button
              type="button"
              onClick={() => setScope("circle")}
              className={`rounded-full px-4 py-2 text-sm ${
                scope === "circle"
                  ? "bg-[var(--color-dawn)] font-semibold text-[var(--color-night)]"
                  : "border border-white/15 text-[var(--color-mist)]"
              }`}
            >
              Friend circle
            </button>
            <button
              type="button"
              onClick={() => setScope("global")}
              className={`rounded-full px-4 py-2 text-sm ${
                scope === "global"
                  ? "bg-[var(--color-dawn)] font-semibold text-[var(--color-night)]"
                  : "border border-white/15 text-[var(--color-mist)]"
              }`}
            >
              Global
            </button>
            {scope === "circle" && circles.length > 0 ? (
              <select
                value={circleId}
                onChange={(e) => setCircleId(e.target.value)}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white outline-none"
              >
                {circles.map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                    className="bg-[var(--color-night)]"
                  >
                    {c.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <p className="mt-3 text-xs text-[var(--color-mist)]">
            {scope === "discord"
              ? "Shows Dawn users who share your Discord server board (login with Discord + bot board)."
              : scope === "circle"
                ? "Only people in the invite-code friend circle."
                : "Everyone who finished Dawn onboarding."}
          </p>

          {/* Metric */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {METRICS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMetric(m.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm ${
                  metric === m.id
                    ? "border border-[var(--color-dawn)] bg-[var(--color-dawn)]/15 text-[var(--color-dawn)]"
                    : "border border-white/10 text-[var(--color-mist)]"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <p className="mt-3 text-xs text-[var(--color-mist)]">
            Ranking by {labels[metric] || metricMeta.label}
          </p>

          {/* Your rank card */}
          {me ? (
            <section className="mt-6 rounded-2xl border border-[var(--color-dawn)]/35 bg-[var(--color-dawn)]/10 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-dawn)]">
                Your place
              </p>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-display text-3xl text-white">
                    #{me.rank}
                  </p>
                  <p className="text-sm text-[var(--color-mist)]">
                    {me.name} · Lv {me.level}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl text-[var(--color-dawn)]">
                    {formatScore(metric, me.score)}
                  </p>
                  <p className="text-xs text-[var(--color-mist)]">
                    {metricMeta.unit}
                    {me.upToday
                      ? me.onTimeToday
                        ? " · up on time"
                        : " · up today"
                      : " · not checked in"}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {/* Podium */}
          {!loading && top.length > 0 ? (
            <div className="mt-8 grid grid-cols-3 items-end gap-2 sm:gap-3">
              {[top[1], top[0], top[2]].map((r, idx) => {
                if (!r) return <div key={idx} />;
                const place = r.rank;
                const tall = place === 1;
                return (
                  <div
                    key={r.userId}
                    className={`rounded-2xl border px-2 py-4 text-center sm:px-3 ${
                      place === 1
                        ? "border-[var(--color-dawn)]/50 bg-[var(--color-dawn)]/15"
                        : "border-white/10 bg-white/[0.03]"
                    } ${tall ? "pb-6 sm:pb-8" : ""}`}
                  >
                    <p className="text-xs text-[var(--color-mist)]">#{place}</p>
                    {r.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.image}
                        alt=""
                        className="mx-auto mt-2 h-12 w-12 rounded-full border border-white/20 sm:h-14 sm:w-14"
                      />
                    ) : (
                      <div className="mx-auto mt-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white sm:h-14 sm:w-14">
                        {r.name.slice(0, 1)}
                      </div>
                    )}
                    <p className="mt-2 truncate text-sm font-medium text-white">
                      {r.isMe ? "You" : r.name}
                    </p>
                    <p className="mt-1 font-display text-xl text-[var(--color-dawn)]">
                      {formatScore(metric, r.score)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Full table */}
          <section className="mt-8">
            <h2 className="font-display text-2xl text-white">Full board</h2>
            {loading ? (
              <p className="mt-4 text-[var(--color-mist)]">Loading ranks…</p>
            ) : emptyReason ? (
              <p className="mt-4 text-[var(--color-mist)]">{emptyReason}</p>
            ) : rows.length === 0 ? (
              <p className="mt-4 text-[var(--color-mist)]">
                No one on the board yet — finish onboarding and check in.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {rows.map((r) => (
                  <li
                    key={r.userId}
                    className={`flex items-center gap-3 rounded-2xl border px-3 py-3 sm:px-4 ${
                      r.isMe
                        ? "border-[var(--color-dawn)]/40 bg-[var(--color-dawn)]/10"
                        : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                        r.rank <= 3
                          ? "bg-[var(--color-dawn)] text-[var(--color-night)]"
                          : "bg-white/10 text-white"
                      }`}
                    >
                      {medal(r.rank)}
                    </span>
                    {r.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.image}
                        alt=""
                        className="h-9 w-9 rounded-full border border-white/20"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs text-white">
                        {r.name.slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white">
                        {r.isMe ? `${r.name} (you)` : r.name}
                      </p>
                      <p className="text-xs text-[var(--color-mist)]">
                        Lv {r.level} · wake {r.wakeGoal}
                        {r.hasDiscord ? " · Discord" : ""}
                        {r.upToday
                          ? r.onTimeToday
                            ? " · up on time"
                            : " · up"
                          : " · not up"}
                        {" · "}
                        {r.wakeOnTime7}/7 early this week
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-xl text-[var(--color-dawn)]">
                        {formatScore(metric, r.score)}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--color-mist)]">
                        {metricMeta.unit}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="mt-8 text-xs text-[var(--color-mist)]">
            <strong className="text-white">Discord circle</strong> = people who
            logged into Dawn with Discord on your Dawn server. Friend circle =
            invite-code groups. Early streak = on-time wakes in a row.
          </p>
        </div>
      </div>
    </main>
  );
}
