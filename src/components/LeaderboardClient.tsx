"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AppNav } from "@/components/AppNav";
import { IconChevronRight } from "@/components/icons";
import { ShareCardButton } from "@/components/ShareCardButton";
import { shareLeaderboardCard } from "@/lib/share-leaderboard-card";
import { formatStudyDuration } from "@/lib/study-time";

type Metric =
  | "earlyStreak"
  | "openStreak"
  | "xp"
  | "consistency"
  | "totalEarly"
  | "studyWeek"
  | "studyTotal"
  | "habits"
  | "combined";

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
  combined?: number;
  score: number;
  isMe: boolean;
};

type CircleOpt = { id: string; name: string };

const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: "combined", label: "Habits + study", unit: "score" },
  { id: "studyWeek", label: "Study · week", unit: "studied" },
  { id: "studyTotal", label: "Study · all time", unit: "studied" },
  { id: "habits", label: "Habits · 7d", unit: "%" },
  { id: "consistency", label: "7-day on-time", unit: "%" },
  { id: "earlyStreak", label: "Early streak", unit: "days" },
  { id: "openStreak", label: "Open streak", unit: "days" },
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
  const [metric, setMetric] = useState<Metric>("combined");
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

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = p.get("scope");
    const m = p.get("metric");
    const c = p.get("circleId");
    if (s === "circle" || s === "global" || s === "discord") setScope(s);
    if (m && METRICS.some((x) => x.id === m)) setMetric(m as Metric);
    if (c) setCircleId(c);
  }, []);

  if (!session?.user) {
    return (
      <main className="dawn-bg min-h-screen">
        <div className="app-shell mx-auto w-full max-w-xl md:mx-0 md:max-w-none">
          <AppNav active="leaderboard" />
          <p className="app-page mt-10 text-sm text-[var(--color-mist)]">
            Loading board…
          </p>
        </div>
      </main>
    );
  }

  const metricMeta = METRICS.find((m) => m.id === metric)!;
  const top = rows.slice(0, 3);

  return (
    <main className="dawn-bg relative min-h-screen">
      <div className="app-shell relative z-10 mx-auto w-full max-w-xl md:mx-0 md:max-w-none">
        <AppNav active="leaderboard" />
        <div className="app-page-wide mt-6 animate-rise sm:mt-10">
          <p className="ui-kicker">Compete</p>
          <h1 className="ui-title mt-2">Who showed up</h1>
          <p className="ui-sub mt-3">
            {scope === "discord"
              ? "People on your Discord server who logged into Dawn — ranked by habit consistency, study hours, and a combined score. Time only counts after they sign in with Discord."
              : scope === "circle"
                ? "Your friend circle only. Add Discord friends from Friends if this looks empty."
                : "Everyone on Dawn — ranked by habits, study, and streaks."}{" "}
            {today ? `Updated for ${today}.` : ""}{" "}
            Share a card of your rank or the board.
          </p>

          {scope === "discord" && discordBoardName ? (
            <p className="mt-2 text-sm text-[var(--color-leaf)]">
              Board · {discordBoardName} · {rows.length} people
            </p>
          ) : null}

          {!hasDiscord ? (
            <a
              href="/settings?tab=discord"
              className="mt-4 inline-flex items-center gap-1 steel-plate rounded-2xl bg-[var(--color-dawn)]/10 px-4 py-3 text-sm text-[var(--color-cloud)]"
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
              className={`ui-chip ${scope === "discord" ? "is-on" : ""}`}
            >
              Discord circle
            </button>
            <button
              type="button"
              onClick={() => setScope("circle")}
              className={`ui-chip ${scope === "circle" ? "is-on" : ""}`}
            >
              Friend circle
            </button>
            <button
              type="button"
              onClick={() => setScope("global")}
              className={`ui-chip ${scope === "global" ? "is-on" : ""}`}
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
                ? "Only people in the invite-code / Discord friend circle."
                : "Everyone who finished Dawn onboarding."}
          </p>

          {/* Metric */}
          <div className="ui-scroll mt-4 flex gap-2 pb-1">
            {METRICS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMetric(m.id)}
                className={`ui-chip shrink-0 ${metric === m.id ? "is-on" : ""}`}
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
            <section className="mt-6 steel-plate rounded-2xl bg-[var(--color-dawn)]/10 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-dawn)]">
                  Your place
                </p>
                <ShareCardButton
                  label="Share board"
                  disabled={loading || (!me && rows.length === 0)}
                  make={() =>
                    shareLeaderboardCard({
                      metricLabel: labels[metric] || metricMeta.label,
                      scopeLabel:
                        scope === "discord"
                          ? discordBoardName || "Discord circle"
                          : scope === "circle"
                            ? circles.find((c) => c.id === circleId)?.name ||
                              "Friend circle"
                            : "Global",
                      date: today,
                      me: me
                        ? {
                            rank: me.rank,
                            name: me.name,
                            scoreLabel: formatScore(metric, me.score),
                          }
                        : null,
                      rows: rows.slice(0, 8).map((r) => ({
                        rank: r.rank,
                        name: r.name,
                        scoreLabel: formatScore(metric, r.score),
                        isMe: r.isMe,
                      })),
                    })
                  }
                />
              </div>
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
                    className={`steel-plate rounded-2xl px-2 py-4 text-center sm:px-3 ${
                      place === 1
                        ? "bg-[var(--color-dawn)]/15"
                        : "bg-white/[0.03]"
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
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl text-white">Full board</h2>
              {!me && rows.length > 0 ? (
                <ShareCardButton
                  label="Share board"
                  make={() =>
                    shareLeaderboardCard({
                      metricLabel: labels[metric] || metricMeta.label,
                      scopeLabel:
                        scope === "discord"
                          ? discordBoardName || "Discord circle"
                          : scope === "circle"
                            ? circles.find((c) => c.id === circleId)?.name ||
                              "Friend circle"
                            : "Global",
                      date: today,
                      me: null,
                      rows: rows.slice(0, 8).map((r) => ({
                        rank: r.rank,
                        name: r.name,
                        scoreLabel: formatScore(metric, r.score),
                        isMe: r.isMe,
                      })),
                    })
                  }
                />
              ) : null}
            </div>
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
                    className={`ui-row !min-h-0 ${
                      r.isMe ? "is-done" : ""
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
            invite-code groups (you can also add Discord / same-server friends
            in one tap). Combined score = 7-day habit % + weekly study hours.
          </p>
        </div>
      </div>
    </main>
  );
}
