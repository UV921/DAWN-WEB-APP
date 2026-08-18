"use client";

import { useCallback, useEffect, useState } from "react";
import { MissionLiveRow } from "@/components/TodayMissions";
import { MAX_MISSION_DAYS, type MissionKind, type MissionPublic } from "@/lib/missions";

type HabitOpt = { key: string; label: string; active?: boolean };

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

const LENGTHS_RUN = [3, 7, 14, 21, 30];
const LENGTHS_MANUAL = [2, 3, 7, 14, 30, 60, 90, 180];

export function MissionSetup({
  onStarted,
  compact,
}: {
  onStarted?: () => void;
  compact?: boolean;
}) {
  const [missions, setMissions] = useState<MissionPublic[]>([]);
  const [habits, setHabits] = useState<HabitOpt[]>([]);
  const [selected, setSelected] = useState<string[]>(["wakeEarly"]);
  const [customLabel, setCustomLabel] = useState("");
  const [newHabits, setNewHabits] = useState<{ label: string }[]>([]);
  const [tasks, setTasks] = useState<string[]>([]);
  const [taskDraft, setTaskDraft] = useState("");
  const [kind, setKind] = useState<MissionKind>("manual");
  const [title, setTitle] = useState("Hackathon");
  const [note, setNote] = useState("");
  const [days, setDays] = useState(3);
  const [daysText, setDaysText] = useState("3");
  const [customPick, setCustomPick] = useState(false);
  const [ongoing, setOngoing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [creating, setCreating] = useState(false);

  const live = missions.filter((m) => m.active && !m.progress.ended);

  const load = useCallback(async () => {
    const res = await fetch("/api/mission");
    if (!res.ok) return;
    const data = await res.json();
    setMissions(data.missions || []);
    setHabits(data.habits || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (kind === "run") {
      setOngoing(false);
      setDays((d) => (d < 3 ? 7 : d));
      setDaysText((t) => {
        const n = Math.round(Number(t));
        return !Number.isFinite(n) || n < 3 ? "7" : t;
      });
      setSelected((prev) =>
        prev.includes("wakeEarly") ? prev : ["wakeEarly", ...prev]
      );
      setTitle((t) => (t === "Hackathon" ? "Morning mission" : t));
    } else {
      setTitle((t) => (t === "Morning mission" ? "Hackathon" : t));
    }
  }, [kind]);

  function toggleKey(key: string) {
    if (kind === "run" && key === "wakeEarly") return;
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
    const typed = Math.round(Number(daysText));
    const length =
      kind === "manual" && ongoing
        ? 0
        : Number.isFinite(typed) && typed > 0
          ? kind === "run"
            ? Math.min(90, Math.max(3, typed))
            : Math.min(MAX_MISSION_DAYS, Math.max(1, typed))
          : days;
    const res = await fetch("/api/mission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        kind,
        title,
        note,
        days: length,
        habitKeys: selected,
        newHabits,
        taskTemplates: tasks,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMsg(String(err.error || "Could not start mission."));
      return;
    }
    setMsg(
      kind === "manual"
        ? ongoing
          ? "Long mission started — it stays on Today until you end it."
          : `${title} is on Today.`
        : `${days}-day mission started.`
    );
    setCreating(false);
    setNewHabits([]);
    setTasks([]);
    await load();
    onStarted?.();
  }

  async function endMission(id: string) {
    if (!confirm("End this mission?")) return;
    setBusy(true);
    await fetch("/api/mission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "end", missionId: id }),
    });
    setBusy(false);
    await load();
  }

  async function checkIn(id: string, done: boolean) {
    const res = await fetch("/api/mission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check", missionId: id, done }),
    });
    if (!res.ok) return;
    await load();
  }

  async function setMissionDays(id: string, daysValue: number) {
    await fetch("/api/mission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-days", missionId: id, days: daysValue }),
    });
    await load();
  }

  if (live.length && !creating) {
    return (
      <div className="space-y-4">
        {live.map((mission) => (
          <section
            key={mission.id}
            className="rounded-2xl border border-[var(--color-dawn)]/30 bg-[var(--color-dawn)]/[0.07] px-5 py-5"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-dawn)]">
              {mission.kind === "manual" ? "Manual mission" : "Habit run"}
            </p>
            <div className="mt-2">
              <MissionLiveRow
                mission={mission}
                onCheck={
                  mission.kind === "manual"
                    ? (done) => void checkIn(mission.id, done)
                    : undefined
                }
                onSetDays={(daysValue) => void setMissionDays(mission.id, daysValue)}
                showEnd
                onEnd={() => void endMission(mission.id)}
              />
            </div>
          </section>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => setCreating(true)}
          className="rounded-full border border-white/20 px-4 py-2 text-xs text-white"
        >
          New mission
        </button>
        {msg ? <p className="text-sm text-[var(--color-leaf)]">{msg}</p> : null}
      </div>
    );
  }

  if (!creating && !live.length) {
    if (compact) return null;
    return (
      <section className="rounded-2xl border border-dashed border-white/20 px-5 py-5">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-dawn)]">
          Mission
        </p>
        <p className="font-display mt-2 text-2xl text-white">
          Hackathon, exam, a long build
        </p>
        <p className="mt-2 text-sm text-[var(--color-mist)]">
          Manual missions stay on Today. Mark the days you worked. Habit runs
          are the short wake-early stretches.
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
  const lengths = kind === "run" ? LENGTHS_RUN : LENGTHS_MANUAL;

  return (
    <section className="rounded-2xl border border-[var(--color-dawn)]/25 bg-[var(--color-dawn)]/[0.05] px-5 py-5 space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-dawn)]">
          Setup
        </p>
        <h2 className="font-display mt-1 text-2xl text-white">Your mission</h2>
        <p className="mt-2 text-sm text-[var(--color-mist)]">
          Manual missions (hackathon, project) can run for months. Habit runs
          stay short and pin wake-early.
        </p>
      </div>

      <div>
        <p className="text-sm text-[var(--color-mist)]">Type</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              { id: "manual", label: "Manual / project" },
              { id: "run", label: "Habit run" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setKind(opt.id)}
              className={`rounded-full border px-3.5 py-1.5 text-sm ${
                kind === opt.id
                  ? "border-[var(--color-dawn)] bg-[var(--color-dawn)]/15 text-[var(--color-dawn)]"
                  : "border-white/15 text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm text-[var(--color-mist)]">How long?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {lengths.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setOngoing(false);
                setCustomPick(false);
                setDays(n);
                setDaysText(String(n));
              }}
              className={`rounded-full border px-3.5 py-1.5 text-sm ${
                !ongoing && !customPick && days === n
                  ? "border-[var(--color-dawn)] bg-[var(--color-dawn)]/15 text-[var(--color-dawn)]"
                  : "border-white/15 text-white"
              }`}
            >
              {n} days
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setOngoing(false);
              setCustomPick(true);
              setDaysText("");
            }}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${
              !ongoing && (customPick || !lengths.includes(days))
                ? "border-[var(--color-dawn)] bg-[var(--color-dawn)]/15 text-[var(--color-dawn)]"
                : "border-white/15 text-white"
            }`}
          >
            Custom
          </button>
          {kind === "manual" ? (
            <button
              type="button"
              onClick={() => {
                setOngoing(true);
                setCustomPick(false);
              }}
              className={`rounded-full border px-3.5 py-1.5 text-sm ${
                ongoing
                  ? "border-[var(--color-dawn)] bg-[var(--color-dawn)]/15 text-[var(--color-dawn)]"
                  : "border-white/15 text-white"
              }`}
            >
              Ongoing
            </button>
          ) : null}
        </div>
        {kind === "manual" && ongoing ? (
          <p className="mt-2 text-xs text-[var(--color-mist)]">
            No end date. It stays on Today and Stats until you end it.
          </p>
        ) : (
          <label className="mt-3 block text-sm text-[var(--color-mist)]">
            Or type the number of days
            <input
              type="number"
              inputMode="numeric"
              min={kind === "run" ? 3 : 1}
              max={kind === "run" ? 90 : MAX_MISSION_DAYS}
              value={daysText}
              onChange={(e) => {
                const raw = e.target.value;
                setDaysText(raw);
                setOngoing(false);
                setCustomPick(true);
                const n = Math.round(Number(raw));
                if (!Number.isFinite(n) || n < 1) return;
                setDays(
                  kind === "run"
                    ? Math.min(90, Math.max(3, n))
                    : Math.min(MAX_MISSION_DAYS, Math.max(1, n))
                );
              }}
              placeholder={kind === "run" ? "7" : "12"}
              className="ui-field mt-2 w-40 text-sm !px-3 !py-2"
            />
          </label>
        )}
      </div>

      <label className="block text-sm text-[var(--color-mist)]">
        Mission name
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Hackathon"
          className="ui-field mt-2"
        />
      </label>

      {kind === "manual" ? (
        <label className="block text-sm text-[var(--color-mist)]">
          What you’re tracking
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ship the demo. One focused block a day."
            className="ui-field mt-2"
          />
        </label>
      ) : null}

      <div>
        <p className="text-sm text-[var(--color-mist)]">
          {kind === "manual"
            ? "Optional habits (also on Today)"
            : "Habits to track"}
        </p>
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
            placeholder="e.g. Push a commit, Review PRs"
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
          {busy
            ? "Starting…"
            : ongoing
              ? "Start ongoing mission"
              : `Start ${days}-day mission`}
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
