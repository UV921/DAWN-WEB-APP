"use client";

import { useCallback, useEffect, useState } from "react";

type HabitOpt = { key: string; label: string; active?: boolean };

type Mission = {
  id: string;
  title: string;
  startDate: string;
  days: number;
  habitKeys: string[];
  taskTemplates: string[];
  progress: {
    active: boolean;
    day: number;
    total: number;
    daysLeft: number;
    ended: boolean;
  } | null;
  habitStats?: {
    key: string;
    label: string;
    doneToday: boolean;
    daysDone: number;
  }[];
};

const QUICK = [
  { key: "wakeEarly", label: "Wake early" },
  { key: "noPhone", label: "No phone" },
  { key: "gym", label: "Gym / move" },
  { key: "reading", label: "Reading" },
  { key: "quran", label: "Quran" },
  { key: "fajr", label: "Fajr" },
  { key: "walk", label: "Morning walk" },
  { key: "journal", label: "Journal" },
];

export function MissionSetup({
  onStarted,
  compact,
}: {
  onStarted?: () => void;
  compact?: boolean;
}) {
  const [mission, setMission] = useState<Mission | null>(null);
  const [habits, setHabits] = useState<HabitOpt[]>([]);
  const [selected, setSelected] = useState<string[]>(["wakeEarly"]);
  const [customLabel, setCustomLabel] = useState("");
  const [newHabits, setNewHabits] = useState<{ label: string }[]>([]);
  const [tasks, setTasks] = useState<string[]>([]);
  const [taskDraft, setTaskDraft] = useState("");
  const [title, setTitle] = useState("Morning mission");
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/mission");
    if (!res.ok) return;
    const data = await res.json();
    setMission(data.mission);
    setHabits(data.habits || []);
    if (data.mission?.habitKeys?.length) {
      setSelected(data.mission.habitKeys);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleKey(key: string) {
    if (key === "wakeEarly") return; // always on
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function addCustomHabit() {
    const label = customLabel.trim();
    if (!label) return;
    setNewHabits((prev) => [...prev, { label }]);
    setCustomLabel("");
  }

  function addTask() {
    const t = taskDraft.trim();
    if (!t) return;
    setTasks((prev) => [...prev, t].slice(0, 10));
    setTaskDraft("");
  }

  async function startMission() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/mission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        title,
        days: days,
        habitKeys: selected,
        newHabits,
        taskTemplates: tasks,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg("Could not start mission.");
      return;
    }
    setMsg("7-day mission started.");
    setCreating(false);
    setNewHabits([]);
    await load();
    onStarted?.();
  }

  async function endMission() {
    if (!confirm("End this mission?")) return;
    setBusy(true);
    await fetch("/api/mission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "end" }),
    });
    setBusy(false);
    await load();
  }

  if (mission?.progress?.active && !creating) {
    const p = mission.progress;
    return (
      <section
        className={`steel-plate rounded-2xl bg-[var(--color-dawn)]/[0.07] px-5 py-5 ${compact ? "" : ""}`}
      >
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-dawn)]">
          Mission
        </p>
        <h2 className="font-display mt-1 text-2xl text-white">{mission.title}</h2>
        <p className="mt-1 text-sm text-[var(--color-mist)]">
          Day {p.day} of {p.total} · {p.daysLeft} left
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/30">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--color-ember)] to-[var(--color-dawn)]"
            style={{
              width: `${Math.min(100, Math.round((p.day / p.total) * 100))}%`,
            }}
          />
        </div>
        {mission.habitStats?.length ? (
          <ul className="mt-4 space-y-2">
            {mission.habitStats.map((h) => (
              <li
                key={h.key}
                className="flex items-center justify-between text-sm"
              >
                <span
                  className={
                    h.doneToday
                      ? "text-[var(--color-leaf)]"
                      : "text-[var(--color-cloud)]"
                  }
                >
                  {h.doneToday ? "✓ " : "○ "}
                  {h.label}
                </span>
                <span className="text-xs text-[var(--color-mist)]">
                  {h.daysDone}/{p.day} days
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {mission.taskTemplates?.length ? (
          <p className="mt-3 text-xs text-[var(--color-mist)]">
            Daily tasks: {mission.taskTemplates.join(" · ")}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setCreating(true)}
            className="rounded-full border border-white/20 px-4 py-2 text-xs text-white"
          >
            New mission
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void endMission()}
            className="rounded-full border border-white/10 px-4 py-2 text-xs text-[var(--color-mist)]"
          >
            End
          </button>
        </div>
      </section>
    );
  }

  if (!creating && !mission) {
    if (compact) return null;
    return (
      <section className="rounded-2xl border border-dashed border-white/20 px-5 py-5">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-dawn)]">
          Mission
        </p>
        <p className="font-display mt-2 text-2xl text-white">
          Build your own run
        </p>
        <p className="mt-2 text-sm text-[var(--color-mist)]">
          Pick habits and daily tasks yourself, then choose how many days.
        </p>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="ui-btn ui-btn-primary mt-4"
        >
          Start a mission
        </button>
      </section>
    );
  }

  const allOpts = [
    ...QUICK,
    ...habits
      .filter((h) => !QUICK.some((q) => q.key === h.key))
      .map((h) => ({ key: h.key, label: h.label })),
  ];

  return (
    <section className="steel-plate rounded-2xl bg-[var(--color-dawn)]/[0.05] px-5 py-5 space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-dawn)]">
          Setup · pick length
        </p>
        <h2 className="font-display mt-1 text-2xl text-white">Your mission</h2>
        <p className="mt-2 text-sm text-[var(--color-mist)]">
          Choose length, habits + optional daily tasks. You decide what to track.
        </p>
      </div>

      <div>
        <p className="text-sm text-[var(--color-mist)]">How many days?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[3, 7, 14, 21, 30].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setDays(n)}
              className={`rounded-full border px-3.5 py-1.5 text-sm ${
                days === n
                  ? "border-[var(--color-dawn)] bg-[var(--color-dawn)]/15 text-[var(--color-dawn)]"
                  : "border-white/15 text-white"
              }`}
            >
              {n} days
            </button>
          ))}
        </div>
        <input
          type="number"
          min={3}
          max={90}
          value={days}
          onChange={(e) =>
            setDays(
              Math.min(90, Math.max(3, Math.round(Number(e.target.value) || 7)))
            )
          }
          className="ui-field mt-3 w-28 text-sm !px-3 !py-2"
        />
      </div>

      <label className="block text-sm text-[var(--color-mist)]">
        Mission name
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="ui-field mt-2"
        />
      </label>

      <div>
        <p className="text-sm text-[var(--color-mist)]">Habits to track</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {allOpts.map((h) => {
            const on = selected.includes(h.key);
            return (
              <button
                key={h.key}
                type="button"
                onClick={() => toggleKey(h.key)}
                className={`rounded-full border px-3.5 py-1.5 text-sm ${
                  on
                    ? "border-[var(--color-dawn)] bg-[var(--color-dawn)]/15 text-[var(--color-dawn)]"
                    : "border-white/15 text-white"
                }`}
              >
                {on ? "✓ " : "+ "}
                {h.label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="Custom habit name"
            className="ui-field flex-1 text-sm !py-2"
          />
          <button
            type="button"
            onClick={addCustomHabit}
            className="rounded-full border border-white/20 px-4 text-sm text-white"
          >
            Add
          </button>
        </div>
        {newHabits.length ? (
          <ul className="mt-2 space-y-1 text-sm text-[var(--color-leaf)]">
            {newHabits.map((h, i) => (
              <li key={`${h.label}-${i}`}>
                + {h.label}{" "}
                <button
                  type="button"
                  className="text-[var(--color-mist)]"
                  onClick={() =>
                    setNewHabits((prev) => prev.filter((_, j) => j !== i))
                  }
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div>
        <p className="text-sm text-[var(--color-mist)]">
          Daily tasks (asked every morning after wake)
        </p>
        <div className="mt-2 flex gap-2">
          <input
            value={taskDraft}
            onChange={(e) => setTaskDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTask();
              }
            }}
            placeholder="e.g. Drink water, Make bed"
            className="ui-field flex-1 text-sm !py-2"
          />
          <button
            type="button"
            onClick={addTask}
            className="rounded-full border border-white/20 px-4 text-sm text-white"
          >
            Add
          </button>
        </div>
        {tasks.length ? (
          <ul className="mt-2 space-y-1 text-sm text-[var(--color-cloud)]">
            {tasks.map((t, i) => (
              <li key={`${t}-${i}`} className="flex justify-between gap-2">
                <span>· {t}</span>
                <button
                  type="button"
                  className="text-xs text-[var(--color-mist)]"
                  onClick={() =>
                    setTasks((prev) => prev.filter((_, j) => j !== i))
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void startMission()}
          className="ui-btn ui-btn-primary"
        >
          {busy ? "Starting…" : `Start ${days}-day mission`}
        </button>
        <button
          type="button"
          onClick={() => setCreating(false)}
          className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-[var(--color-mist)]"
        >
          Cancel
        </button>
      </div>
      {msg ? <p className="text-sm text-[var(--color-leaf)]">{msg}</p> : null}
    </section>
  );
}
