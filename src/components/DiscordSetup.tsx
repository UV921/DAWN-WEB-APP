"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { IconChevronRight } from "@/components/icons";
import { channelIdFromInput } from "@/lib/bot-messages";

type ChecklistItem = {
  id: string;
  done: boolean;
  title: string;
  detail: string;
};

type SetupData = {
  user: {
    discordId: string | null;
    discordNotifyDefault: string;
    discordChannelId: string | null;
    name: string | null;
  };
  config: {
    clientId: string | null;
    guildId: string | null;
    defaultChannelId: string | null;
    inviteUrl: string | null;
    oauthReady: boolean;
    botConfigured: boolean;
  };
  checklist: ChecklistItem[];
};

const MODES = [
  {
    value: "dm",
    label: "DM me",
    help: "Private morning / reminder pings in Discord DMs.",
  },
  {
    value: "channel",
    label: "Channel only",
    help: "Posts to your progress channel (friends can see).",
  },
  {
    value: "both",
    label: "Channel + DM",
    help: "Best of both — board + private nudge.",
  },
  {
    value: "off",
    label: "Off",
    help: "No Discord pings (browser reminders still work).",
  },
] as const;

export function DiscordSetup() {
  const { data: session } = useSession();
  const [data, setData] = useState<SetupData | null>(null);
  const [channelId, setChannelId] = useState("");
  const [studyIds, setStudyIds] = useState("");
  const [studyRooms, setStudyRooms] = useState<
    { channelId: string; name: string }[]
  >([]);
  const [mode, setMode] = useState("dm");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/discord/setup");
    if (!res.ok) return;
    const json = (await res.json()) as SetupData;
    setData(json);
    setChannelId(json.user.discordChannelId || "");
    setMode(json.user.discordNotifyDefault || "dm");
    try {
      const studyRes = await fetch("/api/study");
      if (studyRes.ok) {
        const study = (await studyRes.json()) as {
          rooms?: { channelId: string; name: string }[];
        };
        setStudyRooms(study.rooms || []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePrefs(patch: Record<string, unknown>) {
    setBusy(true);
    setMsg("");
    setErr("");
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setBusy(false);
    if (!res.ok) {
      setErr("Could not save.");
      return;
    }
    setMsg("Saved.");
    await load();
  }

  async function saveStudyRooms() {
    setBusy(true);
    setMsg("");
    setErr("");
    const res = await fetch("/api/study", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add-room", channelIds: studyIds }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(json.error || "Could not save study rooms.");
      return;
    }
    setStudyRooms(json.rooms || []);
    setStudyIds("");
    setMsg("Study rooms saved. Sit in one — Dawn picks it up within a minute.");
  }

  async function removeStudyRoom(channelId: string) {
    setBusy(true);
    setMsg("");
    setErr("");
    const res = await fetch("/api/study", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove-room", channelId }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(json.error || "Could not remove room.");
      return;
    }
    setStudyRooms(json.rooms || []);
    setMsg("Removed.");
  }

  async function test(action: "test-dm" | "test-channel") {
    setBusy(true);
    setMsg("");
    setErr("");
    const res = await fetch("/api/discord/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, channelId }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !json.ok) {
      setErr(
        json.error ||
          "Test failed. Share a server with the bot and allow DMs from server members."
      );
      return;
    }
    setMsg(
      action === "test-dm"
        ? "Check your Discord DMs — test message sent."
        : "Check your channel — test message sent."
    );
  }

  const linked = Boolean(data?.user.discordId || session?.user?.discordId);
  const doneCount = data?.checklist.filter((c) => c.done).length ?? 0;
  const total = data?.checklist.length ?? 6;

  return (
    <section className="space-y-8">
      <div>
        <h2 className="font-display text-2xl text-white sm:text-3xl">
          Discord setup
        </h2>
        <p className="mt-2 text-sm text-[var(--color-mist)]">
          Connect Discord so Dawn can DM you at wake time, post to a channel,
          and run the morning bot. Follow the steps — each one has a clear
          action.
        </p>
        {data ? (
          <p className="mt-3 text-sm text-[var(--color-leaf)]">
            Setup progress · {doneCount}/{total}
          </p>
        ) : null}
      </div>

      {/* Checklist */}
      <ul className="space-y-2">
        {(data?.checklist || []).map((c, i) => (
          <li
            key={c.id}
            className={`rounded-2xl border px-4 py-3 ${
              c.done
                ? "border-[var(--color-leaf)]/30 bg-[var(--color-leaf)]/5"
                : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <div className="flex gap-3">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  c.done
                    ? "bg-[var(--color-leaf)] text-[var(--color-night)]"
                    : "border border-white/25 text-[var(--color-mist)]"
                }`}
              >
                {c.done ? "✓" : i + 1}
              </span>
              <div>
                <p className="font-medium text-white">{c.title}</p>
                <p className="mt-0.5 text-sm text-[var(--color-mist)]">
                  {c.detail}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Step: Link account */}
      <div className="rounded-2xl border border-[var(--color-dawn)]/25 bg-[var(--color-dawn)]/[0.06] px-5 py-5">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-dawn)]">
          Step A · Link your Discord
        </p>
        <p className="mt-2 text-white">
          {linked
            ? `Linked as ${session?.user?.name || data?.user.name || "Discord user"}`
            : "You’re not linked yet — Dawn needs Discord login for DMs."}
        </p>
        <p className="mt-2 text-sm text-[var(--color-mist)]">
          {linked
            ? "If DMs fail, make sure you share a server with the Dawn bot and allow DMs from server members."
            : "Sign out, then on Login tap Continue with Discord. That stores your Discord id for DMs."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {!linked ? (
            <>
              <button
                type="button"
                onClick={() =>
                  void signIn("discord", { callbackUrl: "/settings?tab=discord" })
                }
                className="rounded-full bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-white"
              >
                Connect Discord
              </button>
              <button
                type="button"
                onClick={() =>
                  void signOut({ callbackUrl: "/login" }).then(() => undefined)
                }
                className="rounded-full border border-white/20 px-5 py-2.5 text-sm text-white"
              >
                Sign out first
              </button>
            </>
          ) : (
            <p className="font-mono text-xs text-[var(--color-mist)]">
              id · {data?.user.discordId || session?.user?.discordId}
            </p>
          )}
        </div>
      </div>

      {/* Step: Invite bot */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-mist)]">
          Step B · Add Dawn bot to your server
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--color-cloud)]">
          <li>Open the invite link (needs Manage Server on that Discord).</li>
          <li>Pick your study / accountability server, then Authorize.</li>
          <li>
            Keep View Channel, Send Messages, and Embed Links checked. If the
            channel is private, add the Dawn bot role to it after inviting.
          </li>
          <li>
            Keep the bot online: run{" "}
            <code className="text-[var(--color-dawn)]">npm run bot</code> in a
            terminal.
          </li>
        </ol>
        {data?.config.inviteUrl ? (
          <a
            href={data.config.inviteUrl}
            target="_blank"
            rel="noreferrer"
            className="ui-btn ui-btn-primary mt-4"
          >
            Invite Dawn bot
            <IconChevronRight size={16} />
          </a>
        ) : (
          <p className="mt-4 text-sm text-[var(--color-ember)]">
            Invite link unavailable — admin must set DISCORD_CLIENT_ID.
          </p>
        )}
      </div>

      {/* Step: Channel */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-mist)]">
          Step C · Progress channel (optional but recommended)
        </p>
        <p className="mt-2 text-sm text-[var(--color-mist)]">
          In Discord: User Settings, Advanced, turn on{" "}
          <strong className="text-white">Developer Mode</strong>. Then
          right‑click your progress channel and{" "}
          <strong className="text-white">Copy Channel ID</strong>, or copy the
          channel link. Paste below. The Dawn bot must be in that server and
          allowed to View Channel, Send Messages, and Embed Links — private
          channels need the bot role added.
        </p>
        {data?.config.defaultChannelId ? (
          <p className="mt-2 text-xs text-[var(--color-mist)]">
            Server default channel:{" "}
            <code className="text-[var(--color-dawn)]">
              {data.config.defaultChannelId}
            </code>{" "}
            (used if you leave this blank)
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={channelId}
            onChange={(e) => setChannelId(channelIdFromInput(e.target.value))}
            placeholder="Channel ID or discord.com/channels/… link"
            className="ui-field flex-1 font-mono text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void savePrefs({ discordChannelId: channelId.trim() || null })
            }
            className="rounded-full border border-white/20 px-5 py-3 text-sm text-white disabled:opacity-50"
          >
            Save channel
          </button>
        </div>
      </div>

      {/* Step: Notify mode */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-mist)]">
          Step D · Where should Dawn ping you?
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              disabled={busy}
              onClick={() => {
                setMode(m.value);
                void savePrefs({ discordNotifyDefault: m.value });
              }}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                mode === m.value
                  ? "border-[var(--color-dawn)] bg-[var(--color-dawn)]/10"
                  : "border-white/10 hover:border-white/25"
              }`}
            >
              <p className="font-medium text-white">{m.label}</p>
              <p className="mt-1 text-xs text-[var(--color-mist)]">{m.help}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Study voice rooms */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-mist)]">
          Step E · Study voice rooms
        </p>
        <p className="mt-2 text-sm text-[var(--color-mist)]">
          Dawn counts time you spend in these voice channels (its own timer —
          not LionBot). In Discord Developer Portal → Bot, turn on{" "}
          <strong className="text-white">Server Voice States</strong>. Then
          either run{" "}
          <code className="text-[var(--color-dawn)]">/study-room add</code> or
          paste voice channel IDs here.
        </p>
        {studyRooms.length ? (
          <ul className="mt-3 space-y-1.5">
            {studyRooms.map((r) => (
              <li
                key={r.channelId}
                className="flex items-center justify-between gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate text-white">
                  {r.name}
                  <span className="ml-2 font-mono text-xs text-[var(--color-mist)]">
                    {r.channelId}
                  </span>
                </span>
                {r.name !== "From .env" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeStudyRoom(r.channelId)}
                    className="shrink-0 text-xs text-[var(--color-mist)] hover:text-white"
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-[var(--color-mist)]">
            None yet. Right-click a voice channel → Copy Channel ID.
          </p>
        )}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={studyIds}
            onChange={(e) => setStudyIds(e.target.value)}
            placeholder="Voice channel IDs, comma-separated"
            className="ui-field flex-1 font-mono text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveStudyRooms()}
            className="rounded-full border border-white/20 px-5 py-3 text-sm text-white disabled:opacity-50"
          >
            Save rooms
          </button>
        </div>
      </div>

      {/* Test */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-mist)]">
          Step F · Test it
        </p>
        <p className="mt-2 text-sm text-[var(--color-mist)]">
          Send a test now. If the channel test says missing access (50001),
          re-invite the bot and check channel permissions. If DM fails: open
          Discord Privacy → allow DMs from server members, and share a server
          with the bot.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !linked}
            onClick={() => void test("test-dm")}
            className="ui-btn ui-btn-primary"
          >
            Send test DM
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void test("test-channel")}
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm text-white disabled:opacity-40"
          >
            Send test to channel
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-[var(--color-mist)]">
        <p className="font-medium text-white">Morning calls from Discord</p>
        <p className="mt-1">
          With the bot running, Dawn can DM “are you awake?”, take your plan at
          night, and post reports. Web settings here control{" "}
          <em className="text-white">where reminders go</em>. Slash commands
          like <code className="text-[var(--color-dawn)]">/sleep</code> and{" "}
          <code className="text-[var(--color-dawn)]">/report</code> live in the
          Discord server once the bot is invited.
        </p>
      </div>

      {msg ? <p className="text-sm text-[var(--color-leaf)]">{msg}</p> : null}
      {err ? <p className="text-sm text-[var(--color-ember)]">{err}</p> : null}
    </section>
  );
}
