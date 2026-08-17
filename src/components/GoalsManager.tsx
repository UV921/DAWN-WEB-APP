"use client";

import { useCallback, useEffect, useState } from "react";

type Goal = {
  id: string;
  title: string;
  description: string;
  targetTime: string | null;
  kind: string;
  active: boolean;
};

export function GoalsManager({
  wakeGoal,
  sleepGoal,
  onWakeSleepChange,
}: {
  wakeGoal: string;
  sleepGoal: string;
  onWakeSleepChange?: (wake: string, sleep: string) => void;
}) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetTime, setTargetTime] = useState("");
  const [withReminder, setWithReminder] = useState(true);
  const [notifyDiscord, setNotifyDiscord] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/goals");
    if (!res.ok) return;
    const data = await res.json();
    setGoals(data.goals || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addGoal() {
    if (!title.trim()) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim(),
        targetTime: targetTime || null,
        withReminder: withReminder && Boolean(targetTime),
        notifyDiscord,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg("Could not add goal.");
      return;
    }
    setTitle("");
    setDescription("");
    setTargetTime("");
    setAdding(false);
    setMsg("Goal added.");
    await load();
  }

  async function patchGoal(id: string, patch: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch("/api/goals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    setBusy(false);
    if (!res.ok) return;
    const data = await res.json();
    if (data.goal?.kind === "wake" && data.goal.targetTime) {
      onWakeSleepChange?.(data.goal.targetTime, sleepGoal);
    }
    if (data.goal?.kind === "sleep" && data.goal.targetTime) {
      onWakeSleepChange?.(wakeGoal, data.goal.targetTime);
    }
    await load();
  }

  async function removeGoal(id: string) {
    setBusy(true);
    await fetch(`/api/goals?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setBusy(false);
    await load();
  }

  const core = goals.filter((g) => g.kind === "wake" || g.kind === "sleep");
  const custom = goals.filter((g) => g.kind === "custom");

  return (
    <section className="mt-8 space-y-8">
      <div>
        <h2 className="font-display text-2xl text-white">Named goals</h2>
        <p className="mt-2 text-sm text-[var(--color-mist)]">
          Beyond the clock — things you want mornings (or nights) to protect.
          Optional target time + reminder.
        </p>
      </div>

      {core.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {core.map((g) => (
            <div
              key={g.id}
              className="steel-plate rounded-2xl bg-white/[0.03] px-4 py-4"
            >
              <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-mist)]">
                {g.kind}
              </p>
              <p className="mt-1 font-medium text-white">{g.title}</p>
              <label className="mt-3 block text-xs text-[var(--color-mist)]">
                Target
                <input
                  type="time"
                  value={g.targetTime || ""}
                  disabled={busy}
                  onChange={(e) =>
                    void patchGoal(g.id, { targetTime: e.target.value || null })
                  }
                  className="ui-field mt-1 text-sm !py-2"
                />
              </label>
            </div>
          ))}
        </div>
      ) : null}

      <ul className="space-y-2">
        {custom.map((g) => (
          <li
            key={g.id}
            className={`steel-plate rounded-2xl px-4 py-4 ${
              g.active
                ? "bg-white/[0.03]"
                : "bg-transparent opacity-50"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">{g.title}</p>
                {g.description ? (
                  <p className="mt-1 text-sm text-[var(--color-mist)]">
                    {g.description}
                  </p>
                ) : null}
                {g.targetTime ? (
                  <p className="mt-2 font-mono text-xs text-[var(--color-dawn)]">
                    By {g.targetTime}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-[var(--color-mist)]">
                    No time target
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="time"
                  value={g.targetTime || ""}
                  disabled={busy}
                  onChange={(e) =>
                    void patchGoal(g.id, { targetTime: e.target.value || null })
                  }
                  className="ui-field text-sm !px-2 !py-1.5"
                  aria-label="Target time"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void patchGoal(g.id, { active: !g.active })}
                  className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-white"
                >
                  {g.active ? "Hide" : "Show"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeGoal(g.id)}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[var(--color-mist)]"
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-full border border-white/20 px-5 py-2.5 text-sm text-white hover:border-[var(--color-dawn)]"
        >
          + Add a goal
        </button>
      ) : (
        <form
          className="space-y-3 steel-plate rounded-2xl bg-[var(--color-dawn)]/[0.05] px-5 py-5"
          onSubmit={(e) => {
            e.preventDefault();
            void addGoal();
          }}
        >
          <p className="font-display text-xl text-white">New goal</p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Deep work before 8"
            autoFocus
            className="ui-field"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Why this matters to you"
            className="ui-field"
          />
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-[var(--color-mist)]">
              Target time
              <input
                type="time"
                value={targetTime}
                onChange={(e) => setTargetTime(e.target.value)}
                className="ui-field !px-3 !py-2"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-white">
              <input
                type="checkbox"
                checked={withReminder}
                onChange={(e) => setWithReminder(e.target.checked)}
              />
              Reminder
            </label>
            <label className="flex items-center gap-2 text-sm text-white">
              <input
                type="checkbox"
                checked={notifyDiscord}
                onChange={(e) => setNotifyDiscord(e.target.checked)}
              />
              Discord
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy || !title.trim()}
              className="ui-btn ui-btn-primary"
            >
              Save goal
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="ui-btn ui-btn-ghost ui-btn-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {msg ? <p className="text-sm text-[var(--color-leaf)]">{msg}</p> : null}
    </section>
  );
}
