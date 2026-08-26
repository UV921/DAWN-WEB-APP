"use client";

import { useCallback, useEffect, useState } from "react";
import { channelIdFromInput } from "@/lib/bot-messages";
import { UiMessage } from "@/components/UiMessage";
import type { GuildManageReason, MorningBoardRow } from "@/lib/discord-guild";

type BoardPayload = {
  canManage: boolean;
  isOwner: boolean;
  reason: GuildManageReason | null;
  linkedDiscord: boolean;
  boards: MorningBoardRow[];
  hint: string | null;
};

const TOGGLES: {
  key: "pingEnabled" | "boardEnabled" | "reviewEnabled" | "reportEnabled";
  timeKey: "pingTime" | "leaderboardTime" | "reviewTime" | "reportTime";
  label: string;
  help: string;
}[] = [
  {
    key: "pingEnabled",
    timeKey: "pingTime",
    label: "Wake ping",
    help: "DM everyone on the board: are you awake? No reply = not awake.",
  },
  {
    key: "boardEnabled",
    timeKey: "leaderboardTime",
    label: "Morning board",
    help: "Post who woke and who didn’t in the Discord channel.",
  },
  {
    key: "reviewEnabled",
    timeKey: "reviewTime",
    label: "Night check-in",
    help: "Server-wide night DM asking if today’s tasks are done.",
  },
  {
    key: "reportEnabled",
    timeKey: "reportTime",
    label: "Daily report ping",
    help: "Channel report that @mentions people who need focus.",
  },
];

function reasonLabel(reason: GuildManageReason | null, isOwner: boolean) {
  if (isOwner || reason === "owner") return "Discord owner";
  if (reason === "administrator") return "Administrator";
  if (reason === "manage_guild") return "Manage Server";
  return "server manager";
}

export function MorningBoardSettings() {
  const [data, setData] = useState<BoardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newChannel, setNewChannel] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(
    null
  );
  const [times, setTimes] = useState<Record<string, MorningBoardRow>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/discord/board", { cache: "no-store" });
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const json = (await res.json()) as BoardPayload;
    setData(json);
    setTimes(
      Object.fromEntries((json.boards || []).map((b) => [b.id, b]))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/discord/board", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({
          tone: "error",
          text:
            (typeof json.error === "string" && json.error) ||
            "Couldn’t save. Try again.",
        });
        return;
      }
      setMsg({ tone: "success", text: "Saved. The bot uses this from now on." });
      await load();
    } catch {
      setMsg({
        tone: "error",
        text: "Couldn’t reach Dawn to save. Check your connection.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="h-40 rounded-2xl bg-white/[0.04]" />;
  }

  if (!data?.linkedDiscord) {
    return (
      <UiMessage tone="tip" title="Server pings">
        Sign in with Discord to see server wake pings. Your own morning DM is
        still under Bot messages.
      </UiMessage>
    );
  }

  if (!data.canManage) {
    return (
      <UiMessage tone="tip" title="Server wake pings">
        {data.hint ||
          "Only the Discord owner, or someone with Manage Server, can turn the “who woke up” pings on or off."}{" "}
        Your personal morning DM is on{" "}
        <a
          href="/settings?tab=bot"
          className="text-[var(--color-dawn)] underline-offset-2 hover:underline"
        >
          Bot messages
        </a>
        .
      </UiMessage>
    );
  }

  const boards = data.boards || [];

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-[var(--color-dawn)]/30 bg-[var(--color-dawn)]/[0.07] px-5 py-5">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-dawn)]">
          Server · {reasonLabel(data.reason, data.isOwner)}
        </p>
        <h3 className="mt-2 font-display text-xl text-white">
          Morning board pings
        </h3>
        <p className="mt-2 text-sm text-[var(--color-mist)]">
          These hit the whole Discord — wake DMs, the public “who’s up / not
          awake” board, night check-in, and the report that pings people. Off
          here means Dawn will not auto-send them. Members can still use{" "}
          <code className="text-[var(--color-dawn)]">/woke</code>.
        </p>
      </div>

      {boards.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5">
          <p className="font-medium text-white">No morning board yet</p>
          <p className="mt-2 text-sm text-[var(--color-mist)]">
            Paste the progress channel ID (or a discord.com/channels/… link).
            Pings stay off until you turn them on.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={newChannel}
              onChange={(e) => setNewChannel(channelIdFromInput(e.target.value))}
              placeholder="Channel ID or link"
              className="ui-field flex-1 font-mono text-sm"
            />
            <button
              type="button"
              disabled={busy || !newChannel.trim()}
              onClick={() => void patch({ channelId: newChannel.trim() })}
              className="rounded-full border border-white/20 px-5 py-3 text-sm text-white disabled:opacity-50"
            >
              Add board
            </button>
          </div>
        </div>
      ) : null}

      {boards.map((board) => {
        const draft = times[board.id] || board;
        const anyOn =
          board.pingEnabled ||
          board.boardEnabled ||
          board.reviewEnabled ||
          board.reportEnabled;
        return (
          <div
            key={board.id}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-white">#{board.name}</p>
                <p className="mt-0.5 text-xs text-[var(--color-mist)]">
                  {board.guildName ? `${board.guildName} · ` : ""}
                  {board.memberCount} on the board
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void patch({ id: board.id, allEnabled: !anyOn })
                }
                className={`rounded-full border px-3 py-1.5 text-[12px] ${
                  anyOn
                    ? "border-white/20 text-white"
                    : "border-[var(--color-dawn)] bg-[var(--color-dawn)]/15 text-[var(--color-dawn)]"
                } disabled:opacity-50`}
              >
                {anyOn ? "Turn all off" : "Turn all on"}
              </button>
            </div>

            <ul className="mt-4 space-y-3">
              {TOGGLES.map((t) => (
                <li
                  key={t.key}
                  className="rounded-xl border border-white/10 px-3 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{t.label}</p>
                      <p className="mt-0.5 text-xs text-[var(--color-mist)]">
                        {t.help}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void patch({
                          id: board.id,
                          [t.key]: !board[t.key],
                        })
                      }
                      className={`rounded-full border px-3 py-1.5 text-[12px] ${
                        board[t.key]
                          ? "border-[var(--color-dawn)] bg-[var(--color-dawn)]/15 text-[var(--color-dawn)]"
                          : "border-white/20 text-white"
                      } disabled:opacity-50`}
                    >
                      {board[t.key] ? "On" : "Off"}
                    </button>
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-xs text-[var(--color-mist)]">
                    Time
                    <input
                      type="time"
                      value={draft[t.timeKey]}
                      disabled={busy}
                      onChange={(e) =>
                        setTimes((prev) => ({
                          ...prev,
                          [board.id]: {
                            ...(prev[board.id] || board),
                            [t.timeKey]: e.target.value,
                          },
                        }))
                      }
                      className="ui-field w-[7.5rem] py-1.5 font-mono text-sm"
                    />
                  </label>
                </li>
              ))}
            </ul>

            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void patch({
                  id: board.id,
                  pingTime: draft.pingTime,
                  leaderboardTime: draft.leaderboardTime,
                  reviewTime: draft.reviewTime,
                  reportTime: draft.reportTime,
                })
              }
              className="mt-4 rounded-full border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Save times
            </button>
          </div>
        );
      })}

      {msg ? (
        <p
          className={
            msg.tone === "success"
              ? "text-sm text-[var(--color-leaf)]"
              : "text-sm text-[var(--color-ember)]"
          }
        >
          {msg.text}
        </p>
      ) : null}
    </section>
  );
}
