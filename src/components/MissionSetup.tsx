"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MissionLiveRow } from "@/components/TodayMissions";
import {
  draftFromMission,
  emptyDraft,
  MissionAddRow,
  MissionEditor,
  payloadFromDraft,
  type MissionDraft,
} from "@/components/MissionEditor";
import type { MissionKind, MissionPublic } from "@/lib/missions";

type HabitOpt = { key: string; label: string; active?: boolean };

const HABIT_QUICK = [
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
  focusId,
}: {
  onStarted?: () => void;
  compact?: boolean;
  focusId?: string | null;
}) {
  const [missions, setMissions] = useState<MissionPublic[]>([]);
  const [habits, setHabits] = useState<HabitOpt[]>([]);
  const [today, setToday] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [customLabel, setCustomLabel] = useState("");
  const [newHabits, setNewHabits] = useState<{ label: string }[]>([]);
  const [tasks, setTasks] = useState<string[]>([]);
  const [taskDraft, setTaskDraft] = useState("");
  const [kind, setKind] = useState<MissionKind>("manual");
  const [draft, setDraft] = useState<MissionDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const openedFocus = useRef<string | null>(null);

  const live = missions.filter((m) => m.active && !m.progress.ended);
  const day = today || new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    const res = await fetch("/api/mission");
    if (!res.ok) return;
    const data = await res.json();
    setMissions(data.missions || []);
    setHabits(data.habits || []);
    if (typeof data.today === "string") setToday(data.today);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetExtras(nextKind: MissionKind = kind) {
    setSelected(nextKind === "run" ? ["wakeEarly"] : []);
    setNewHabits([]);
    setTasks([]);
    setTaskDraft("");
    setCustomLabel("");
  }

  function beginCreate(seed?: MissionDraft) {
    setEditingId(null);
    setStoppingId(null);
    setKind("manual");
    resetExtras("manual");
    setDraft(seed || emptyDraft(day));
    setCreating(true);
    setMsg("");
  }

  function beginEdit(m: MissionPublic) {
    setCreating(false);
    setStoppingId(null);
    setKind(m.kind);
    setSelected(m.habitKeys.length ? m.habitKeys : m.kind === "run" ? ["wakeEarly"] : []);
    setNewHabits([]);
    setTasks(m.taskTemplates || []);
    setDraft(draftFromMission(m));
    setEditingId(m.id);
    setMsg("");
  }

  useEffect(() => {
    if (!focusId || openedFocus.current === focusId) return;
    const mission = missions.find(
      (m) => m.id === focusId && m.active && !m.progress.ended
    );
    if (!mission) return;
    openedFocus.current = focusId;
    beginEdit(mission);
    requestAnimationFrame(() => {
      document
        .getElementById(`mission-${focusId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [focusId, missions]);

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

  async function save() {
    if (!draft) return;
    setBusy(true);
    setMsg("");
    const payload = payloadFromDraft(draft);
    const res = await fetch("/api/mission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        editingId
          ? {
              action: "update",
              missionId: editingId,
              kind,
              ...payload,
              habitKeys: selected,
              taskTemplates: tasks,
            }
          : {
              action: "create",
              kind,
              ...payload,
              habitKeys: selected,
              newHabits,
              taskTemplates: tasks,
            }
      ),
    });
    setBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMsg(String(err.error || "Could not save mission."));
      return;
    }
    setMsg(editingId ? "Mission updated." : `${payload.title} is on Today.`);
    setCreating(false);
    setEditingId(null);
    setDraft(null);
    resetExtras();
    await load();
    onStarted?.();
  }

  async function addQuick(next: MissionDraft) {
    setBusy(true);
    setMsg("");
    const payload = payloadFromDraft(next);
    const res = await fetch("/api/mission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        kind: "manual",
        ...payload,
        habitKeys: [],
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMsg(String(err.error || "Could not add mission."));
      return;
    }
    setMsg(`${payload.title} is on Today.`);
    await load();
    onStarted?.();
  }

  async function stopMission(id: string) {
    setBusy(true);
    await fetch("/api/mission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "end", missionId: id }),
    });
    setBusy(false);
    setStoppingId(null);
    if (editingId === id) {
      setEditingId(null);
      setDraft(null);
    }
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

  async function mutateStep(body: Record<string, unknown>) {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/mission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(String(data.error || "Could not update steps."));
    }
    await load();
  }

  const allOpts = [
    ...HABIT_QUICK,
    ...habits
      .filter((h) => !HABIT_QUICK.some((q) => q.key === h.key))
      .map((h) => ({ key: h.key, label: h.label })),
  ];

  const extras = (
    <div className="space-y-4">
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
              onClick={() => {
                setKind(opt.id);
                if (opt.id === "run") {
                  setSelected((prev) =>
                    prev.includes("wakeEarly") ? prev : ["wakeEarly", ...prev]
                  );
                }
              }}
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
        <p className="text-sm text-[var(--color-mist)]">
          {kind === "manual" ? "Optional habits" : "Habits to track"}
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
        <p className="text-sm text-[var(--color-mist)]">Daily tasks</p>
        <p className="mt-0.5 text-[11px] text-[var(--color-mist)]">
          Optional. These copy onto Today’s task list — mission steps are on
          the card above.
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
            placeholder="e.g. Push a commit"
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
    </div>
  );

  if (compact && !live.length && !creating) return null;

  return (
    <div className="space-y-4">
      <MissionAddRow
        today={day}
        busy={busy && creating && !editingId}
        onAdd={(d) => void addQuick(d)}
      />

      {creating && draft && !editingId ? (
        <MissionEditor
          draft={draft}
          onChange={setDraft}
          busy={busy}
          saveLabel="Start mission"
          onSave={() => void save()}
          onCancel={() => {
            setCreating(false);
            setDraft(null);
          }}
        >
          {extras}
        </MissionEditor>
      ) : (
        <button
          type="button"
          onClick={() => beginCreate()}
          className="text-xs text-[var(--color-dawn)]"
        >
          More options
        </button>
      )}

      {live.length ? (
        <ul className="space-y-4">
          {live.map((mission) => (
            <li
              key={mission.id}
              id={`mission-${mission.id}`}
              className={`rounded-2xl border bg-[var(--color-dawn)]/[0.07] px-5 py-5 ${
                focusId === mission.id
                  ? "border-[var(--color-dawn)]/70 ring-1 ring-[var(--color-dawn)]/35"
                  : "border-[var(--color-dawn)]/30"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-dawn)]">
                {mission.kind === "manual" ? "Manual mission" : "Habit run"}
              </p>
              <div className="mt-2">
                <MissionLiveRow
                  mission={mission}
                  busy={busy && (editingId === mission.id || stoppingId === mission.id)}
                  editing={editingId === mission.id}
                  stopping={stoppingId === mission.id}
                  draft={editingId === mission.id ? draft : null}
                  onDraft={setDraft}
                  onCheck={
                    mission.kind === "manual"
                      ? (done) => void checkIn(mission.id, done)
                      : undefined
                  }
                  onEdit={() => beginEdit(mission)}
                  onCancelEdit={() => {
                    setEditingId(null);
                    setDraft(null);
                  }}
                  onSaveEdit={() => void save()}
                  onAskStop={() => {
                    setCreating(false);
                    setEditingId(null);
                    setDraft(null);
                    setStoppingId(mission.id);
                  }}
                  onKeep={() => setStoppingId(null)}
                  onStop={() => void stopMission(mission.id)}
                  extra={editingId === mission.id ? extras : undefined}
                  onAddStep={(text) =>
                    void mutateStep({
                      action: "add-step",
                      missionId: mission.id,
                      text,
                    })
                  }
                  onToggleStep={(stepId, done) =>
                    void mutateStep({ action: "toggle-step", stepId, done })
                  }
                  onDeleteStep={(stepId) =>
                    void mutateStep({ action: "delete-step", stepId })
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      ) : !creating ? (
        <p className="text-sm text-[var(--color-mist)]">
          Add a mission above. Pick a start and end date — like a hackathon
          weekend.
        </p>
      ) : null}

      {msg ? <p className="text-sm text-[var(--color-leaf)]">{msg}</p> : null}
    </div>
  );
}
