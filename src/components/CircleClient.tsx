"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import {
  DEFAULT_HABITS,
  completedCount,
  isHabitDone,
  type HabitDef,
} from "@/lib/habits";

type MemberUser = {
  id: string;
  name: string | null;
  image: string | null;
  discordId?: string | null;
  openStreak?: number;
  wakeGoal?: string;
  level?: number;
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

type MemberStats = {
  checkedIn: boolean;
  wakeOnTime: boolean;
  earlyStreak: number;
  openStreak: number;
  level: number;
  xp: number;
  wakeGoal: string;
  wakeDays7: number;
  needsNudge: boolean;
};

type Circle = {
  id: string;
  name: string;
  inviteCode: string;
  discordChannelId: string | null;
  ownerId: string;
  members: { userId: string; user: MemberUser }[];
  owner?: { id: string; name: string | null };
};

type Board = {
  circleId: string;
  date: string;
  summary: { total: number; up: number; onTime: number; needNudge: number };
  members: {
    user: MemberUser;
    log: Log | null;
    stats: MemberStats;
  }[];
};

export function CircleClient() {
  const { data: session } = useSession();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [howTo, setHowTo] = useState<string[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [circleName, setCircleName] = useState("Morning Circle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showHow, setShowHow] = useState(true);
  const [myHabits, setMyHabits] = useState<HabitDef[]>([...DEFAULT_HABITS]);

  const load = useCallback(async () => {
    const [circleRes, habitRes] = await Promise.all([
      fetch("/api/circle"),
      fetch("/api/habit-defs"),
    ]);
    if (habitRes.ok) {
      const h = await habitRes.json();
      if (h.habits?.length) setMyHabits(h.habits);
    }
    if (!circleRes.ok) {
      setLoading(false);
      return;
    }
    const data = await circleRes.json();
    setCircles(data.circles || []);
    setBoards(data.boards || []);
    setHowTo(data.howTo || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 45_000);
    return () => window.clearInterval(t);
  }, [load]);

  async function api(action: string, payload: Record<string, unknown> = {}) {
    setBusy(true);
    setMessage("");
    setError("");
    const res = await fetch("/api/circle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Something failed");
      return null;
    }
    return data;
  }

  async function createCircle() {
    const data = await api("create", { name: circleName });
    if (!data) return;
    setMessage(
      `Circle created. Share code ${data.circle.inviteCode} with your friend.`
    );
    await load();
  }

  async function joinCircle() {
    const data = await api("join", { inviteCode });
    if (!data) return;
    setMessage("You’re in. Check the board below.");
    setInviteCode("");
    await load();
  }

  async function copyInvite(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setMessage(`Copied invite code ${code}`);
    } catch {
      setMessage(`Invite code: ${code}`);
    }
  }

  async function copyInviteLink(code: string) {
    const url = `${window.location.origin}/circle?join=${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Invite link copied — send it to your friend.");
    } catch {
      setMessage(url);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const join = params.get("join");
    if (join) setInviteCode(join.toUpperCase());
  }, []);

  if (!session?.user) {
    return (
      <main className="dawn-bg flex min-h-screen items-center justify-center text-[var(--color-mist)]">
        Loading…
      </main>
    );
  }

  const habitKeys = myHabits.map((h) => h.key);
  const totalHabits = Math.max(habitKeys.length, 1);
  const empty = !loading && circles.length === 0;

  return (
    <main className="dawn-bg noise relative min-h-screen">
      <div className="app-shell relative z-10 mx-auto max-w-5xl">
        <AppNav active="circle" />
        <div className="mt-6 animate-rise sm:mt-10">
          <p className="ui-kicker">Accountability</p>
          <h1 className="ui-title mt-2">Friend circle</h1>
          <p className="ui-sub mt-3">
            Create or join a circle, share the code, then check in on Today —
            friends see who’s up. Discord nudges are optional.
          </p>

          {(message || error) && (
            <p
              className={`mt-4 text-sm ${error ? "text-[var(--color-ember)]" : "text-[var(--color-leaf)]"}`}
            >
              {error || message}
            </p>
          )}

          {/* How it works */}
          <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5">
            <button
              type="button"
              onClick={() => setShowHow((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="font-display text-xl text-white">
                How friend circles work
              </span>
              <span className="text-sm text-[var(--color-mist)]">
                {showHow ? "Hide" : "Show"}
              </span>
            </button>
            {showHow ? (
              <div className="mt-4 space-y-4">
                <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--color-cloud)]">
                  {(howTo.length
                    ? howTo
                    : [
                        "Create a circle.",
                        "Share the invite code.",
                        "Friend joins on this page.",
                        "Both check in on Today — board updates.",
                      ]
                  ).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      t: "Today board",
                      d: "See who’s checked in, wake time, and habits done.",
                    },
                    {
                      t: "Nudge",
                      d: "Ping a friend on Discord if they’re still asleep (bot must run).",
                    },
                    {
                      t: "Discord channel",
                      d: "Owner can attach a channel so check-ins post for the group.",
                    },
                  ].map((c) => (
                    <div
                      key={c.t}
                      className="rounded-xl border border-white/10 bg-black/20 px-3 py-3"
                    >
                      <p className="text-sm font-medium text-white">{c.t}</p>
                      <p className="mt-1 text-xs text-[var(--color-mist)]">
                        {c.d}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[var(--color-mist)]">
                  Tip: friends should also open{" "}
                  <Link
                    href="/settings?tab=discord"
                    className="text-[var(--color-dawn)] underline-offset-2 hover:underline"
                  >
                    Settings → Discord
                  </Link>{" "}
                  so nudges and DMs work.
                </p>
              </div>
            ) : null}
          </section>

          {/* Create / Join */}
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[var(--color-dawn)]/25 bg-[var(--color-dawn)]/[0.06] px-5 py-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-dawn)]">
                Start a circle
              </p>
              <p className="mt-2 text-sm text-[var(--color-mist)]">
                You’re the owner. You’ll get an invite code to share.
              </p>
              <input
                value={circleName}
                onChange={(e) => setCircleName(e.target.value)}
                placeholder="Circle name"
                className="mt-4 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none focus:border-[var(--color-dawn)]"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void createCircle()}
                className="mt-3 rounded-full bg-[var(--color-dawn)] px-6 py-3 text-sm font-semibold text-[var(--color-night)] disabled:opacity-50"
              >
                Create circle
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-mist)]">
                Join a friend
              </p>
              <p className="mt-2 text-sm text-[var(--color-mist)]">
                Paste the code they sent you (or open their invite link).
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="INVITE CODE"
                  className="w-full flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-mono tracking-widest text-white outline-none focus:border-[var(--color-dawn)]"
                />
                <button
                  type="button"
                  disabled={busy || !inviteCode.trim()}
                  onClick={() => void joinCircle()}
                  className="rounded-full border border-white/20 px-6 py-3 text-sm text-white disabled:opacity-40"
                >
                  Join
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <p className="mt-12 text-[var(--color-mist)]">Loading circles…</p>
          ) : empty ? (
            <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-8 text-center">
              <p className="font-display text-2xl text-white">No circle yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-mist)]">
                Create one above and share the invite code, or paste a friend’s
                code to join. Once you’re in, today’s board shows who’s awake.
              </p>
            </div>
          ) : (
            <div className="mt-12 space-y-10">
              {circles.map((circle) => {
                const board = boards.find((b) => b.circleId === circle.id);
                const isOwner = session.user.id === circle.ownerId;
                return (
                  <section
                    key={circle.id}
                    className="border-t border-white/10 pt-8"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="font-display text-2xl text-white sm:text-3xl">
                          {circle.name}
                        </h2>
                        <p className="mt-1 text-sm text-[var(--color-mist)]">
                          Owner · {circle.owner?.name || "You"} ·{" "}
                          {circle.members.length} member
                          {circle.members.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      {board?.summary ? (
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
                          <p className="text-[var(--color-leaf)]">
                            Up today · {board.summary.up}/{board.summary.total}
                          </p>
                          <p className="text-[var(--color-mist)]">
                            On-time · {board.summary.onTime} · Need nudge ·{" "}
                            {board.summary.needNudge}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    {/* Invite tools */}
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[var(--color-dawn)]/40 bg-[var(--color-dawn)]/10 px-4 py-2 font-mono text-sm text-[var(--color-dawn)]">
                        {circle.inviteCode}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void copyInvite(circle.inviteCode)}
                        className="rounded-full border border-white/20 px-4 py-2 text-xs text-white"
                      >
                        Copy code
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void copyInviteLink(circle.inviteCode)}
                        className="rounded-full border border-white/20 px-4 py-2 text-xs text-white"
                      >
                        Copy invite link
                      </button>
                      {isOwner ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            const data = await api("regenerateInvite", {
                              circleId: circle.id,
                            });
                            if (data) {
                              setMessage(
                                `New code: ${data.circle.inviteCode}`
                              );
                              await load();
                            }
                          }}
                          className="rounded-full border border-white/10 px-4 py-2 text-xs text-[var(--color-mist)]"
                        >
                          New code
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          if (
                            !confirm(
                              isOwner
                                ? "Leave as owner? Ownership transfers to another member, or the circle deletes if you’re alone."
                                : "Leave this circle?"
                            )
                          )
                            return;
                          const data = await api("leave", {
                            circleId: circle.id,
                          });
                          if (data) {
                            setMessage("Left circle.");
                            await load();
                          }
                        }}
                        className="rounded-full border border-white/10 px-4 py-2 text-xs text-[var(--color-mist)]"
                      >
                        Leave
                      </button>
                    </div>

                    {isOwner ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="block text-sm text-[var(--color-mist)]">
                          Rename circle
                          <input
                            key={`name-${circle.id}-${circle.name}`}
                            defaultValue={circle.name}
                            onBlur={async (e) => {
                              const v = e.target.value.trim();
                              if (v && v !== circle.name) {
                                const data = await api("rename", {
                                  circleId: circle.id,
                                  name: v,
                                });
                                if (data) {
                                  setMessage("Renamed.");
                                  await load();
                                }
                              }
                            }}
                            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-[var(--color-dawn)]"
                          />
                        </label>
                        <label className="block text-sm text-[var(--color-mist)]">
                          Discord channel for group check-ins
                          <input
                            key={circle.discordChannelId || circle.id}
                            defaultValue={circle.discordChannelId || ""}
                            placeholder="Channel ID (Developer Mode → Copy)"
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v !== (circle.discordChannelId || "")) {
                                void api("updateChannel", {
                                  circleId: circle.id,
                                  discordChannelId: v,
                                }).then((data) => {
                                  if (data) {
                                    setMessage("Channel saved.");
                                    void load();
                                  }
                                });
                              }
                            }}
                            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 font-mono text-sm text-white outline-none focus:border-[var(--color-dawn)]"
                          />
                        </label>
                      </div>
                    ) : null}

                    {/* Member board */}
                    <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                      {(board?.members || []).map((row) => {
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
                        const isMe = row.user.id === session.user.id;
                        return (
                          <li
                            key={row.user.id}
                            className={`rounded-2xl border p-4 ${
                              row.stats.checkedIn
                                ? "border-[var(--color-dawn)]/35 bg-[var(--color-dawn)]/[0.07]"
                                : "border-white/10 bg-white/[0.03]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3">
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
                                    Lv {row.stats.level} · open {row.stats.openStreak}d ·
                                    early {row.stats.earlyStreak}d
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

                            <p className="mt-3 text-sm text-[var(--color-mist)]">
                              {row.log
                                ? `${score}/${totalHabits} habits · woke ${row.log.wakeTime || "—"} · goal ${row.stats.wakeGoal}`
                                : `Not checked in · wake goal ${row.stats.wakeGoal}`}
                            </p>
                            <p className="mt-1 text-xs text-[var(--color-mist)]">
                              Last 7 days early wakes · {row.stats.wakeDays7}/7
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
                                  onClick={async () => {
                                    const data = await api("nudge", {
                                      circleId: circle.id,
                                      userId: row.user.id,
                                    });
                                    if (data?.ok) {
                                      setMessage(
                                        `Nudged ${row.user.name || "friend"} on Discord.`
                                      );
                                    }
                                  }}
                                  className="rounded-full bg-[var(--color-dawn)] px-4 py-1.5 text-xs font-semibold text-[var(--color-night)] disabled:opacity-50"
                                >
                                  Nudge on Discord
                                </button>
                              ) : null}
                              {isOwner && !isMe ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={async () => {
                                    if (
                                      !confirm(
                                        `Remove ${row.user.name || "member"}?`
                                      )
                                    )
                                      return;
                                    const data = await api("removeMember", {
                                      circleId: circle.id,
                                      userId: row.user.id,
                                    });
                                    if (data) {
                                      setMessage("Member removed.");
                                      await load();
                                    }
                                  }}
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
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
