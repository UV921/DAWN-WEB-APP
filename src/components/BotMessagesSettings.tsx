"use client";

import { useCallback, useEffect, useState } from "react";
import { IconPlus, IconX } from "@/components/icons";
import { UiMessage } from "@/components/UiMessage";
import {
  BOT_MESSAGE_META,
  MAX_CHANNEL_PINGS,
  defaultBotMessages,
  parseBotMessages,
  type BotMessageKey,
  type BotMessages,
  type ChannelPing,
  channelIdFromInput,
} from "@/lib/bot-messages";

type HabitOption = { key: string; label: string };

const VARS = "{name} {wake} {sleep} {goal} {streak} {todos}";

export function BotMessagesSettings() {
  const [settings, setSettings] = useState<BotMessages>(defaultBotMessages());
  const [habits, setHabits] = useState<HabitOption[]>([]);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{
    tone: "success" | "error" | "tip";
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    const [s, h] = await Promise.all([
      fetch("/api/settings").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/habit-defs").then((r) => (r.ok ? r.json() : null)),
    ]);
    if (s) {
      setSettings(parseBotMessages(s.botMessages));
      setChannelId(s.user?.discordChannelId || null);
    }
    if (h?.all) {
      setHabits(
        (h.all as { key: string; label: string; active: boolean }[])
          .filter((x) => x.active)
          .map((x) => ({ key: x.key, label: x.label }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(next: BotMessages) {
    setSettings(next);
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botMessages: next }),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg({ tone: "error", text: "Couldn’t save. Try again." });
      return;
    }
    setMsg({ tone: "success", text: "Saved. The bot uses this from now on." });
  }

  function patchMessage(key: BotMessageKey, patch: Partial<BotMessages[BotMessageKey]>) {
    setSettings((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }

  function patchPing(id: string, patch: Partial<ChannelPing>) {
    setSettings((prev) => ({
      ...prev,
      channelPings: prev.channelPings.map((p) =>
        p.id === id ? { ...p, ...patch } : p
      ),
    }));
  }

  function addPing() {
    setSettings((prev) => ({
      ...prev,
      channelPings: [
        ...prev.channelPings,
        {
          id: `ping-${Date.now()}`,
          label: "Study block",
          time: "19:00",
          text: "Keep studying — get the hours in.",
          enabled: true,
          habitKey: "",
          channelId: "",
        },
      ].slice(0, MAX_CHANNEL_PINGS),
    }));
  }

  function removePing(id: string) {
    setSettings((prev) => ({
      ...prev,
      channelPings: prev.channelPings.filter((p) => p.id !== id),
    }));
  }

  if (loading) {
    return <div className="h-64 rounded-2xl bg-white/[0.04]" />;
  }

  return (
    <section className="space-y-8">
      <div>
        <h2 className="font-display text-2xl text-white sm:text-3xl">
          What the bot says
        </h2>
        <p className="mt-2 text-sm text-[var(--color-mist)]">
          Turn each message off, or write your own. Leave the text blank to keep
          Dawn’s default wording.
        </p>
        <p className="mt-2 text-xs text-[var(--color-mist)]">
          You can use{" "}
          <code className="text-[var(--color-dawn)]">{VARS}</code> — they get
          filled in when the message is sent.
        </p>
      </div>

      <div className="space-y-3">
        {BOT_MESSAGE_META.map((meta) => {
          const value = settings[meta.key];
          return (
            <div
              key={meta.key}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-white">{meta.label}</p>
                  <p className="mt-0.5 text-sm text-[var(--color-mist)]">
                    {meta.help}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={value.enabled}
                  aria-label={`${meta.label} ${value.enabled ? "on" : "off"}`}
                  onClick={() =>
                    patchMessage(meta.key, { enabled: !value.enabled })
                  }
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                    value.enabled
                      ? "bg-[var(--color-dawn)]"
                      : "bg-white/15"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                      value.enabled ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>
              {value.enabled ? (
                <textarea
                  value={value.text}
                  onChange={(e) =>
                    patchMessage(meta.key, { text: e.target.value })
                  }
                  rows={2}
                  maxLength={400}
                  placeholder={meta.defaultText}
                  className="ui-field mt-3 text-sm"
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-[15px] font-medium text-white">
            Your own channel pings
          </h3>
          <p className="mt-1 text-sm text-[var(--color-mist)]">
            The bot posts these at the time you set — for example “keep
            studying” at 7pm. Tie one to a habit and it only fires on days you
            haven’t ticked that habit yet. Each ping can go to its own channel.
          </p>
          {!channelId ? (
            <p className="mt-2 text-sm text-[var(--color-ember)]">
              You have no default channel yet — either set one under the
              Discord tab, or give every ping its own channel ID below.
            </p>
          ) : null}
        </div>

        {settings.channelPings.map((ping) => (
          <div
            key={ping.id}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5"
          >
            <div className="flex items-center gap-2">
              <input
                value={ping.label}
                onChange={(e) => patchPing(ping.id, { label: e.target.value })}
                placeholder="Name it"
                maxLength={60}
                className="ui-field min-w-0 flex-1 !py-2 text-sm"
              />
              <input
                type="time"
                value={ping.time}
                onChange={(e) => patchPing(ping.id, { time: e.target.value })}
                className="ui-field !w-auto shrink-0 !py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removePing(ping.id)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--color-mist)] hover:text-white"
                aria-label={`Remove ${ping.label}`}
              >
                <IconX size={15} />
              </button>
            </div>
            <textarea
              value={ping.text}
              onChange={(e) => patchPing(ping.id, { text: e.target.value })}
              rows={2}
              maxLength={400}
              placeholder="What should the bot post?"
              className="ui-field mt-2 text-sm"
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-[var(--color-mist)]">
                Only if unfinished
                <select
                  value={ping.habitKey}
                  onChange={(e) =>
                    patchPing(ping.id, { habitKey: e.target.value })
                  }
                  className="ui-field !w-auto !py-1.5 text-sm"
                >
                  <option value="" className="bg-[var(--color-night)]">
                    Always send
                  </option>
                  {habits.map((h) => (
                    <option
                      key={h.key}
                      value={h.key}
                      className="bg-[var(--color-night)]"
                    >
                      {h.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--color-mist)]">
                <input
                  type="checkbox"
                  checked={ping.enabled}
                  onChange={(e) =>
                    patchPing(ping.id, { enabled: e.target.checked })
                  }
                  className="h-4 w-4 accent-[var(--color-dawn)]"
                />
                On
              </label>
            </div>
            <input
              value={ping.channelId}
              onChange={(e) =>
                patchPing(ping.id, {
                channelId: channelIdFromInput(e.target.value),
                })
              }
              inputMode="numeric"
              placeholder={
                channelId
                  ? `Channel ID — blank uses ${channelId}`
                  : "Channel ID or link for this ping"
              }
              className="ui-field mt-2 font-mono text-xs"
            />
          </div>
        ))}

        {settings.channelPings.length < MAX_CHANNEL_PINGS ? (
          <button
            type="button"
            onClick={addPing}
            className="ui-btn ui-btn-ghost w-full"
          >
            <IconPlus size={15} />
            Add a channel ping
          </button>
        ) : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5">
        <h3 className="text-[15px] font-medium text-white">
          Where your task list goes
        </h3>
        <p className="mt-1 text-sm text-[var(--color-mist)]">
          The Send button on your tasks posts here. Leave blank to use{" "}
          {channelId ? (
            <code className="text-[var(--color-dawn)]">{channelId}</code>
          ) : (
            "your default channel"
          )}
          .
        </p>
        <input
          value={settings.todosChannelId}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              todosChannelId: channelIdFromInput(e.target.value),
            }))
          }
          inputMode="numeric"
          placeholder="Channel ID or discord.com/channels/… link"
          className="ui-field mt-3 font-mono text-xs"
        />
        <p className="mt-4 text-sm text-[var(--color-mist)]">
          Optional ping when the list goes out. Dawn @’s you in the channel
          with this, and Send now also downloads a PNG then uploads that same
          image (the bot does not fetch it).
        </p>
        <textarea
          value={settings.todosPingText}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              todosPingText: e.target.value,
            }))
          }
          rows={2}
          maxLength={300}
          placeholder="Here's today's list — you've got this."
          className="ui-field mt-2 text-sm"
        />
        <label className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--color-mist)]">
          Daily send time
          <input
            type="time"
            value={settings.todosSendTime}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                todosSendTime: e.target.value,
              }))
            }
            className="ui-field !w-auto !py-1.5 text-sm"
          />
          <span className="text-xs">
            {settings.todosSendTime
              ? `Auto-posts at ${settings.todosSendTime} (your timezone)`
              : "Blank = Send now only"}
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save(settings)}
          className="ui-btn ui-btn-primary"
        >
          {busy ? "Saving…" : "Save bot settings"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save(defaultBotMessages())}
          className="ui-btn-text text-sm"
        >
          Reset to defaults
        </button>
      </div>
      {msg ? <UiMessage tone={msg.tone}>{msg.text}</UiMessage> : null}
    </section>
  );
}
