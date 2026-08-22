"use client";

import { useCallback, useEffect, useState } from "react";
import {
  formatStudyNudgeInterval,
  intervalInputFromMinutes,
  STUDY_NUDGE_PRESETS,
  type StudyNudgeRow,
} from "@/lib/study-nudges";
import {
  requestAndSubscribeWebPush,
  showLocalDawnNotification,
  subscribeWebPush,
} from "@/lib/web-push-client";
import { UiMessage } from "@/components/UiMessage";

type Live = {
  id: string;
  startedAt: string;
  activity?: string | null;
} | null;

export function StudyCareManager({ compact = false }: { compact?: boolean }) {
  const [nudges, setNudges] = useState<StudyNudgeRow[]>([]);
  const [live, setLive] = useState<Live>(null);
  const [hasDiscord, setHasDiscord] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    "default"
  );
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [amount, setAmount] = useState(20);
  const [unit, setUnit] = useState<"min" | "hr">("min");
  const [notifyBrowser, setNotifyBrowser] = useState(true);
  const [notifyDiscord, setNotifyDiscord] = useState(true);
  const [discordTarget, setDiscordTarget] = useState("channel");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/study-nudges");
    if (!res.ok) return;
    const data = await res.json();
    setNudges(data.nudges || []);
    setLive(data.live || null);
    setHasDiscord(Boolean(data.hasDiscord));
    if (
      data.prefs?.discordNotifyDefault &&
      data.prefs.discordNotifyDefault !== "off"
    ) {
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
    const result = await requestAndSubscribeWebPush();
    setPerm(result.permission);
    setMsg(
      result.ok
        ? "Web Push on. Browser alerts keep going after Dawn is closed."
        : result.reason || "Could not enable Web Push."
    );
  }

  async function sendTestPush() {
    setBusy(true);
    setMsg("");
    try {
      const sub = await subscribeWebPush();
      if (!sub.ok) {
        setMsg(sub.reason || "Could not subscribe this Mac for push.");
        return;
      }
      const latest = await fetch("/api/study-nudges", { cache: "no-store" }).then(
        (r) => (r.ok ? r.json() : null)
      );
      if (!latest?.live) {
        setMsg("Start a study session first. Care pings only fire while you are studying.");
        return;
      }
      const preview = {
        title: "Dawn study care",
        body: "This is a session ping — it only sends while you are studying.",
      };
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(
          typeof data.error === "string" ? data.error : "Test push failed."
        );
        return;
      }
      await showLocalDawnNotification(preview);
      setMsg(
        "Session test ping sent. Stop the session and they will not keep sending."
      );
    } catch {
      setMsg("Could not send a test ping.");
    } finally {
      setBusy(false);
    }
  }

  async function addNudge(patch?: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch("/api/study-nudges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        message: message.trim(),
        intervalAmount: amount,
        intervalUnit: unit,
        notifyBrowser,
        notifyDiscord,
        discordTarget,
        ...patch,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(typeof data.error === "string" ? data.error : "Could not add.");
      return;
    }
    setTitle("");
    setMessage("");
    setMsg("Care ping saved. It fires only while a study session is live.");
    await load();
  }

  async function seedPresets() {
    setBusy(true);
    const res = await fetch("/api/study-nudges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed: true }),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg("Could not add the starter pings.");
      return;
    }
    setMsg("Added drink water, rest your eyes, and stretch.");
    await load();
  }

  async function patchNudge(id: string, patch: Record<string, unknown>) {
    setBusy(true);
    await fetch("/api/study-nudges", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    setBusy(false);
    await load();
  }

  async function setAll(enabled: boolean) {
    setBusy(true);
    await fetch("/api/study-nudges", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allEnabled: enabled }),
    });
    setBusy(false);
    setMsg(enabled ? "Study care pings on." : "Study care pings off.");
    await load();
  }

  async function removeNudge(id: string) {
    setBusy(true);
    await fetch(`/api/study-nudges?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    setBusy(false);
    await load();
  }

  const haveKeys = new Set(nudges.map((n) => n.presetKey).filter(Boolean));
  const missingPresets = STUDY_NUDGE_PRESETS.filter((p) => !haveKeys.has(p.key));
  const anyOn = nudges.some((n) => n.enabled);

  return (
    <section className={compact ? "space-y-3" : "mt-10 space-y-6 border-t border-white/10 pt-10"}>
      <div>
        <h2 className="font-display text-3xl text-white">
          {compact ? "Study care pings" : "Study care"}
        </h2>
        <p className="mt-2 text-sm text-[var(--color-mist)]">
          While you study — Discord voice or Start session — Dawn pings you
          after an interval you set. These care pings never send when the
          session is stopped. Clock reminders on this tab are separate. On a
          Mac: System Settings → Notifications → Chrome or Safari → Allow
          Notifications → Alerts. On iPhone, add Dawn to the Home Screen first.
        </p>
        {live ? (
          <p className="mt-2 text-xs text-[var(--color-leaf)]">
            Live session{live.activity ? ` · ${live.activity}` : ""}. First ping
            waits a full interval from when you started.
          </p>
        ) : (
          <p className="mt-2 text-xs text-[var(--color-mist)]">
            No live session. Join a study VC or tap Start on Today.
          </p>
        )}
      </div>

      {perm !== "unsupported" && perm !== "granted" && (
        <button
          type="button"
          onClick={() => void enableBrowser()}
          className="ui-btn ui-btn-primary ui-btn-sm"
        >
          Allow browser notifications
        </button>
      )}
      {perm === "granted" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void sendTestPush()}
          className="rounded-full border border-white/20 px-4 py-2 text-sm text-white"
        >
          Send test push
        </button>
      ) : null}

      {nudges.length > 0 ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void setAll(!anyOn)}
          className={`ui-btn ui-btn-sm ${anyOn ? "ui-btn-ghost" : "ui-btn-primary"}`}
        >
          {anyOn ? "Turn all study care off" : "Turn all study care on"}
        </button>
      ) : null}

      {nudges.length === 0 ? (
        <UiMessage tone="warn" title="Nothing is set yet">
          Live session is on, but there is no water / eyes ping until you add
          one. Tap the button, or fill Custom ping and tap Add care ping.
          <div className="mt-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void seedPresets()}
              className="ui-btn ui-btn-primary ui-btn-sm"
            >
              Add water + eyes + stretch
            </button>
          </div>
        </UiMessage>
      ) : null}

      <ul className="space-y-2">
        {nudges.map((n) => (
          <StudyNudgeEditor
            key={n.id}
            nudge={n}
            busy={busy}
            onPatch={patchNudge}
            onRemove={removeNudge}
          />
        ))}
      </ul>

      {missingPresets.length > 0 && nudges.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {missingPresets.map((p) => (
            <button
              key={p.key}
              type="button"
              disabled={busy}
              onClick={() =>
                void addNudge({
                  presetKey: p.key,
                  title: p.title,
                  message: p.message,
                  intervalMinutes: p.intervalMinutes,
                })
              }
              className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white"
            >
              + {p.title} ({formatStudyNudgeInterval(p.intervalMinutes)})
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void addNudge();
        }}
      >
        <p className="text-sm uppercase tracking-[0.15em] text-[var(--color-mist)]">
          Custom ping
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Drink water"
          className="ui-field"
        />
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Notification text"
          className="ui-field"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--color-mist)]">
            Every
            <input
              type="number"
              min={1}
              max={unit === "hr" ? 12 : 720}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 1)}
              className="ui-field !w-20 !px-3 !py-2"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as "min" | "hr")}
              className="ui-field text-sm !px-3 !py-2"
            >
              <option value="min">minutes</option>
              <option value="hr">hours</option>
            </select>
          </label>
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
          {notifyDiscord && hasDiscord ? (
            <select
              value={discordTarget}
              onChange={(e) => setDiscordTarget(e.target.value)}
              className="ui-field text-sm !px-3 !py-2"
            >
              <option value="channel">Channel</option>
              <option value="dm">DM</option>
              <option value="both">Both</option>
            </select>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="ui-btn ui-btn-primary"
        >
          Add care ping
        </button>
      </form>
      {msg ? <p className="text-sm text-[var(--color-leaf)]">{msg}</p> : null}
    </section>
  );
}

function StudyNudgeEditor({
  nudge,
  busy,
  onPatch,
  onRemove,
}: {
  nudge: StudyNudgeRow;
  busy: boolean;
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const parsed = intervalInputFromMinutes(nudge.intervalMinutes);
  const [amount, setAmount] = useState(parsed.amount);
  const [unit, setUnit] = useState<"min" | "hr">(parsed.unit);

  useEffect(() => {
    const next = intervalInputFromMinutes(nudge.intervalMinutes);
    setAmount(next.amount);
    setUnit(next.unit);
  }, [nudge.intervalMinutes]);

  return (
    <li
      className={`rounded-2xl border px-4 py-3 ${
        nudge.enabled
          ? "border-white/10 bg-white/[0.03]"
          : "border-white/5 opacity-50"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-white">{nudge.title}</p>
          {nudge.message ? (
            <p className="text-sm text-[var(--color-mist)]">{nudge.message}</p>
          ) : null}
          <p className="mt-1 font-mono text-xs text-[var(--color-dawn)]">
            every {formatStudyNudgeInterval(nudge.intervalMinutes)}
            {nudge.notifyBrowser ? " · browser" : ""}
            {nudge.notifyDiscord ? ` · discord (${nudge.discordTarget})` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            max={unit === "hr" ? 12 : 720}
            value={amount}
            disabled={busy}
            onChange={(e) => setAmount(Number(e.target.value) || 1)}
            onBlur={() =>
              void onPatch(nudge.id, {
                intervalAmount: amount,
                intervalUnit: unit,
              })
            }
            className="w-16 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white"
          />
          <select
            value={unit}
            disabled={busy}
            onChange={(e) => {
              const next = e.target.value as "min" | "hr";
              setUnit(next);
              void onPatch(nudge.id, {
                intervalAmount: amount,
                intervalUnit: next,
              });
            }}
            className="rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white"
          >
            <option value="min">min</option>
            <option value="hr">hr</option>
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onPatch(nudge.id, { enabled: !nudge.enabled })}
            className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-white"
          >
            {nudge.enabled ? "On" : "Off"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void onPatch(nudge.id, { notifyBrowser: !nudge.notifyBrowser })
            }
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[var(--color-mist)]"
          >
            Browser
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void onPatch(nudge.id, { notifyDiscord: !nudge.notifyDiscord })
            }
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[var(--color-mist)]"
          >
            Discord
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onRemove(nudge.id)}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[var(--color-mist)]"
          >
            Delete
          </button>
        </div>
      </div>
      {nudge.notifyDiscord ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {(["channel", "dm", "both"] as const).map((t) => (
            <button
              key={t}
              type="button"
              disabled={busy}
              onClick={() => void onPatch(nudge.id, { discordTarget: t })}
              className={`rounded-full px-2.5 py-1 text-xs ${
                nudge.discordTarget === t
                  ? "bg-[var(--color-dawn)]/20 text-[var(--color-dawn)]"
                  : "bg-white/5 text-white/50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      ) : null}
    </li>
  );
}
