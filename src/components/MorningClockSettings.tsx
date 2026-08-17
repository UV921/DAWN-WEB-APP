"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

/**
 * Core morning clock — when Dawn asks “Are you awake?”, then reminders, then tasks.
 */
export function MorningClockSettings() {
  const { update } = useSession();
  const [wakeGoal, setWakeGoal] = useState("06:00");
  const [sleepGoal, setSleepGoal] = useState("23:00");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const u = d.user;
        if (!u) return;
        setWakeGoal(u.wakeGoal || "06:00");
        setSleepGoal(u.sleepGoal || "23:00");
        setTimezone(u.timezone || "Asia/Kolkata");
      })
      .catch(() => undefined);
  }, []);

  async function save() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wakeGoal, sleepGoal, timezone }),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg("Could not save times.");
      return;
    }
    await update();
    setMsg("Morning times saved.");
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-display text-2xl text-white sm:text-3xl">
          Morning ask time
        </h2>
        <p className="mt-2 max-w-lg text-sm text-[var(--color-mist)]">
          Set when Dawn asks <span className="text-white">“Are you awake?”</span>
          . Open the app around that time — after you say yes, it asks for
          reminders, then today’s tasks.
        </p>
      </div>

      <div className="steel-plate rounded-2xl bg-[var(--color-dawn)]/[0.07] px-5 py-6">
        <ol className="space-y-3 text-sm text-[var(--color-cloud)]">
          <li className="flex gap-3">
            <span className="font-mono text-[var(--color-dawn)]">1</span>
            <span>
              At your wake time, Dawn asks: <strong className="text-white">Are you awake?</strong>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono text-[var(--color-dawn)]">2</span>
            <span>Then: any reminders for today?</span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono text-[var(--color-dawn)]">3</span>
            <span>Then: any tasks you want to add today?</span>
          </li>
        </ol>
      </div>

      <label className="block">
        <span className="text-sm text-[var(--color-mist)]">
          Ask “Are you awake?” at
        </span>
        <input
          type="time"
          value={wakeGoal}
          onChange={(e) => setWakeGoal(e.target.value)}
          className="ui-field mt-2 font-mono text-2xl text-[var(--color-dawn)]"
        />
        <span className="mt-2 block text-xs text-[var(--color-mist)]">
          Hold — I’m awake only works in the window around this time.
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm text-[var(--color-mist)]">Sleep by</span>
          <input
            type="time"
            value={sleepGoal}
            onChange={(e) => setSleepGoal(e.target.value)}
            className="ui-field mt-2"
          />
        </label>
        <label className="block">
          <span className="text-sm text-[var(--color-mist)]">Timezone</span>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="ui-field mt-2"
          >
            {[
              "Asia/Kolkata",
              "Asia/Dubai",
              "Asia/Singapore",
              "Europe/London",
              "Europe/Paris",
              "America/New_York",
              "America/Los_Angeles",
              "America/Chicago",
              "UTC",
            ].map((tz) => (
              <option key={tz} value={tz} className="bg-[var(--color-night)]">
                {tz}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="ui-btn ui-btn-primary"
      >
        {busy ? "Saving…" : "Save morning time"}
      </button>
      {msg ? <p className="text-sm text-[var(--color-leaf)]">{msg}</p> : null}
    </section>
  );
}
