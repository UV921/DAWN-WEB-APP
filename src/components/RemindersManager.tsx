"use client";

import { useCallback, useEffect, useState } from "react";
import { IconChevronRight } from "@/components/icons";

type Reminder = {
  id: string;
  title: string;
  message: string;
  time: string;
  enabled: boolean;
  notifyBrowser: boolean;
  notifyDiscord: boolean;
  discordTarget: string;
  discordChannelId: string | null;
  goal?: { id: string; title: string } | null;
};

type Prefs = {
  discordNotifyDefault: string;
  discordChannelId: string | null;
  wakeGoal: string;
  sleepGoal: string;
};

export function RemindersManager() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [hasDiscord, setHasDiscord] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    "default"
  );
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [time, setTime] = useState("06:00");
  const [notifyBrowser, setNotifyBrowser] = useState(true);
  const [notifyDiscord, setNotifyDiscord] = useState(false);
  const [discordTarget, setDiscordTarget] = useState("channel");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/reminders");
    if (!res.ok) return;
    const data = await res.json();
    setReminders(data.reminders || []);
    setPrefs(data.prefs || null);
    setHasDiscord(Boolean(data.hasDiscord));
    if (data.prefs?.discordNotifyDefault && data.prefs.discordNotifyDefault !== "off") {
      setDiscordTarget(data.prefs.discordNotifyDefault);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPerm("unsupported");
    } else {
      setPerm(Notification.permission);
    }
    void load();
  }, [load]);

  async function enableBrowser() {
    if (!("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setPerm(p);
    setMsg(
      p === "granted"
        ? "Browser notifications on. Keep Dawn open or installed."
        : "Permission denied."
    );
  }

  async function savePrefs(patch: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg("Could not save Discord settings.");
      return;
    }
    setMsg("Discord settings saved.");
    await load();
  }

  async function addReminder() {
    if (!title.trim()) return;
    setBusy(true);
    const res = await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        message: message.trim(),
        time,
        notifyBrowser,
        notifyDiscord,
        discordTarget,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg("Could not add reminder.");
      return;
    }
    setTitle("");
    setMessage("");
    setMsg("Reminder added.");
    await load();
  }

  async function patchReminder(id: string, patch: Record<string, unknown>) {
    setBusy(true);
    await fetch("/api/reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    setBusy(false);
    await load();
  }

  async function removeReminder(id: string) {
    setBusy(true);
    await fetch(`/api/reminders?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    setBusy(false);
    await load();
  }

  async function quickSeed() {
    setBusy(true);
    const wake = prefs?.wakeGoal || "06:00";
    const sleep = prefs?.sleepGoal || "23:00";
    await Promise.all([
      fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Wake check-in",
          message: "Log your wake time and morning habits.",
          time: wake,
          notifyBrowser: true,
          notifyDiscord,
          discordTarget,
        }),
      }),
      fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Sleep wind-down",
          message: "Start winding down — phone away, lights out soon.",
          time: sleep,
          notifyBrowser: true,
          notifyDiscord,
          discordTarget,
        }),
      }),
    ]);
    setBusy(false);
    setMsg("Added wake + sleep reminders.");
    await load();
  }

  return (
    <section className="mt-10 space-y-6 border-t border-white/10 pt-10">
      <div>
        <h2 className="font-display text-3xl text-white">Reminders</h2>
        <p className="mt-2 text-sm text-[var(--color-mist)]">
          Browser notifications when Dawn is open/installed. Discord pings go to
          your channel and/or DM when the bot is running.
        </p>
      </div>

      {/* Discord destination — full wizard: Settings → Discord */}
      <div className="steel-plate rounded-2xl bg-white/[0.03] p-4 space-y-3">
        <p className="font-medium text-white">Discord for reminders</p>
        <p className="text-sm text-[var(--color-mist)]">
          {hasDiscord
            ? "Discord linked. Use the Discord tab for invite, DMs, and test pings."
            : "Link Discord in the Discord tab to enable DMs."}
        </p>
        <a
          href="/settings?tab=discord"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-dawn)] underline-offset-2 hover:underline"
        >
          Open Discord setup
          <IconChevronRight size={14} />
        </a>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["channel", "Channel"],
              ["dm", "DM me"],
              ["both", "Channel + DM"],
              ["off", "Off"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              disabled={busy}
              onClick={() =>
                void savePrefs({ discordNotifyDefault: value }).then(() =>
                  setDiscordTarget(value === "off" ? "channel" : value)
                )
              }
              className={`rounded-full border px-3.5 py-1.5 text-sm ${
                prefs?.discordNotifyDefault === value
                  ? "border-[var(--color-dawn)] bg-[var(--color-dawn)]/15 text-[var(--color-dawn)]"
                  : "border-white/20 text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="block text-sm text-[var(--color-mist)]">
          Channel ID (right‑click channel → Copy Channel ID, or paste a channel link)
          <input
            defaultValue={prefs?.discordChannelId || ""}
            key={prefs?.discordChannelId || "ch"}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (prefs?.discordChannelId || "")) {
                void savePrefs({ discordChannelId: v || null });
              }
            }}
            placeholder="e.g. 123456789012345678"
            className="ui-field mt-2 font-mono text-sm"
          />
        </label>
      </div>

      {perm !== "unsupported" && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-[var(--color-mist)]">
            Browser permission: {perm}
          </p>
          {perm !== "granted" && (
            <button
              type="button"
              onClick={() => void enableBrowser()}
              className="ui-btn ui-btn-primary ui-btn-sm"
            >
              Allow notifications
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void quickSeed()}
          className="rounded-full border border-white/20 px-4 py-2 text-sm text-white"
        >
          Add wake + sleep reminders
        </button>
      </div>

      <ul className="space-y-2">
        {reminders.map((r) => (
          <li
            key={r.id}
            className={`steel-plate rounded-2xl px-4 py-3 ${
              r.enabled
                ? "bg-white/[0.03]"
                : "bg-transparent opacity-50"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-white">{r.title}</p>
                {r.message ? (
                  <p className="text-sm text-[var(--color-mist)]">{r.message}</p>
                ) : null}
                <p className="mt-1 font-mono text-xs text-[var(--color-dawn)]">
                  {r.time}
                  {r.notifyBrowser ? " · browser" : ""}
                  {r.notifyDiscord
                    ? ` · discord (${r.discordTarget})`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="time"
                  value={r.time}
                  disabled={busy}
                  onChange={(e) =>
                    void patchReminder(r.id, { time: e.target.value })
                  }
                  className="ui-field text-sm !px-2 !py-1.5"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void patchReminder(r.id, { enabled: !r.enabled })
                  }
                  className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-white"
                >
                  {r.enabled ? "On" : "Off"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void patchReminder(r.id, {
                      notifyBrowser: !r.notifyBrowser,
                    })
                  }
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[var(--color-mist)]"
                >
                  Browser
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void patchReminder(r.id, {
                      notifyDiscord: !r.notifyDiscord,
                    })
                  }
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[var(--color-mist)]"
                >
                  Discord
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeReminder(r.id)}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[var(--color-mist)]"
                >
                  Delete
                </button>
              </div>
            </div>
            {r.notifyDiscord && (
              <div className="mt-2 flex flex-wrap gap-2">
                {(["channel", "dm", "both"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void patchReminder(r.id, { discordTarget: t })
                    }
                    className={`rounded-full px-2.5 py-1 text-xs ${
                      r.discordTarget === t
                        ? "bg-[var(--color-dawn)]/20 text-[var(--color-dawn)]"
                        : "bg-white/5 text-white/50"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void addReminder();
        }}
      >
        <p className="text-sm uppercase tracking-[0.15em] text-[var(--color-mist)]">
          Add reminder
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="ui-field"
        />
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Notification text"
          className="ui-field"
        />
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="ui-field !px-3 !py-2"
          />
          <label className="flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              checked={notifyBrowser}
              onChange={(e) => setNotifyBrowser(e.target.checked)}
            />
            Browser
          </label>
          <label className="flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              checked={notifyDiscord}
              onChange={(e) => setNotifyDiscord(e.target.checked)}
            />
            Discord
          </label>
          {notifyDiscord && (
            <select
              value={discordTarget}
              onChange={(e) => setDiscordTarget(e.target.value)}
              className="ui-field text-sm !px-3 !py-2"
            >
              <option value="channel">Channel</option>
              <option value="dm">DM</option>
              <option value="both">Both</option>
            </select>
          )}
        </div>
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="ui-btn ui-btn-primary"
        >
          Add reminder
        </button>
      </form>
      {msg && <p className="text-sm text-[var(--color-leaf)]">{msg}</p>}
    </section>
  );
}
