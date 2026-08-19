"use client";

import { useState, type ReactNode } from "react";
import {
  daysFromRange,
  formatMissionSpan,
  MAX_MISSION_DAYS,
  MAX_MISSION_STEPS,
  type MissionPublic,
} from "@/lib/missions";

export type MissionDraft = {
  title: string;
  note: string;
  startDate: string;
  endDate: string;
  ongoing: boolean;
  steps?: string[];
};

export function emptyDraft(today: string): MissionDraft {
  return {
    title: "",
    note: "",
    startDate: today,
    endDate: "",
    ongoing: false,
    steps: [],
  };
}

export function draftFromMission(m: MissionPublic): MissionDraft {
  return {
    title: m.title,
    note: m.note || "",
    startDate: m.startDate,
    endDate: m.endDate || "",
    ongoing: Boolean(m.progress.ongoing || !m.days),
    steps: (m.steps || []).map((s) => s.text),
  };
}

export function MissionAddRow({
  today,
  busy,
  onAdd,
}: {
  today: string;
  busy?: boolean;
  onAdd: (draft: MissionDraft) => void;
}) {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [stepDraft, setStepDraft] = useState("");

  function queueStep() {
    const text = stepDraft.trim();
    if (!text || steps.length >= MAX_MISSION_STEPS) return;
    setSteps((prev) => [...prev, text]);
    setStepDraft("");
  }

  function submit() {
    const name = title.trim();
    if (!name) return;
    const pending = stepDraft.trim();
    const nextSteps = pending
      ? [...steps, pending].slice(0, MAX_MISSION_STEPS)
      : steps;
    onAdd({
      title: name,
      note: "",
      startDate: startDate || today,
      endDate,
      ongoing: !endDate,
      steps: nextSteps,
    });
    setTitle("");
    setStartDate(today);
    setEndDate("");
    setSteps([]);
    setStepDraft("");
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.03] py-1 pl-3 pr-1.5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a mission"
          className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-[var(--color-mist)]"
          autoComplete="off"
          enterKeyHint="done"
          maxLength={80}
        />
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="ui-btn ui-btn-primary !h-9 !px-3.5 text-sm"
        >
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-[var(--color-mist)]">
          Starts
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="ui-field mt-1 !px-3 !py-2 text-sm [color-scheme:dark]"
          />
        </label>
        <label className="text-[11px] text-[var(--color-mist)]">
          Ends
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className="ui-field mt-1 !px-3 !py-2 text-sm [color-scheme:dark]"
          />
        </label>
      </div>
      <p className="text-[11px] text-[var(--color-mist)]">
        {endDate
          ? `${daysFromRange(startDate || today, endDate)} days · ${formatMissionSpan(startDate || today, endDate)}`
          : "Leave end empty to keep it going."}
      </p>
      {steps.length ? (
        <ul className="space-y-1">
          {steps.map((step, i) => (
            <li
              key={`${step}-${i}`}
              className="flex items-center justify-between gap-2 text-sm text-white"
            >
              <span className="min-w-0 truncate">○ {step}</span>
              <button
                type="button"
                className="text-xs text-[var(--color-mist)]"
                onClick={() =>
                  setSteps((prev) => prev.filter((_, j) => j !== i))
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {steps.length < MAX_MISSION_STEPS ? (
        <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.03] py-1 pl-3 pr-1.5">
          <input
            value={stepDraft}
            onChange={(e) => setStepDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                queueStep();
              }
            }}
            placeholder="Add a step (optional)"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-[var(--color-mist)]"
            autoComplete="off"
            maxLength={120}
          />
          <button
            type="button"
            disabled={!stepDraft.trim()}
            onClick={queueStep}
            className="rounded-lg px-3 py-1.5 text-sm text-[var(--color-dawn)] disabled:opacity-40"
          >
            Add step
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-[var(--color-mist)]">
          Max {MAX_MISSION_STEPS} steps.
        </p>
      )}
    </form>
  );
}

export function MissionEditor({
  draft,
  onChange,
  busy,
  saveLabel = "Save",
  onSave,
  onCancel,
  children,
}: {
  draft: MissionDraft;
  onChange: (next: MissionDraft) => void;
  busy?: boolean;
  saveLabel?: string;
  onSave: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const span = draft.ongoing
    ? "No end date"
    : draft.startDate && draft.endDate
      ? `${daysFromRange(draft.startDate, draft.endDate)} days · ${formatMissionSpan(draft.startDate, draft.endDate)}`
      : "Pick a start and end";

  return (
    <div className="space-y-3 rounded-xl border border-white/12 bg-black/20 px-3 py-3">
      <label className="block text-sm text-[var(--color-mist)]">
        Mission name
        <input
          value={draft.title}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
          placeholder="Hackathon"
          className="ui-field mt-1.5 !px-3 !py-2 text-sm"
          maxLength={80}
        />
      </label>
      <label className="block text-sm text-[var(--color-mist)]">
        Note
        <input
          value={draft.note}
          onChange={(e) => onChange({ ...draft, note: e.target.value })}
          placeholder="What you’re building"
          className="ui-field mt-1.5 !px-3 !py-2 text-sm"
          maxLength={200}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm text-[var(--color-mist)]">
          Starts
          <input
            type="date"
            value={draft.startDate}
            onChange={(e) =>
              onChange({
                ...draft,
                startDate: e.target.value,
                endDate:
                  draft.endDate && e.target.value && draft.endDate < e.target.value
                    ? e.target.value
                    : draft.endDate,
              })
            }
            className="ui-field mt-1.5 !px-3 !py-2 text-sm [color-scheme:dark]"
          />
        </label>
        <label className="text-sm text-[var(--color-mist)]">
          Ends
          <input
            type="date"
            value={draft.ongoing ? "" : draft.endDate}
            min={draft.startDate || undefined}
            disabled={draft.ongoing}
            onChange={(e) =>
              onChange({ ...draft, endDate: e.target.value, ongoing: false })
            }
            className="ui-field mt-1.5 !px-3 !py-2 text-sm [color-scheme:dark] disabled:opacity-40"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={() =>
          onChange({
            ...draft,
            ongoing: !draft.ongoing,
            endDate: draft.ongoing ? draft.endDate : "",
          })
        }
        className={`rounded-full border px-3 py-1 text-xs ${
          draft.ongoing
            ? "border-[var(--color-dawn)] text-[var(--color-dawn)]"
            : "border-white/15 text-[var(--color-mist)]"
        }`}
      >
        {draft.ongoing ? "Ongoing · no end" : "No end date"}
      </button>
      <p className="text-xs text-[var(--color-mist)]">{span}</p>
      {children}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !draft.title.trim() || !draft.startDate}
          onClick={onSave}
          className="ui-btn ui-btn-primary !px-4 !py-2 text-sm"
        >
          {busy ? "Saving…" : saveLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-white/15 px-4 py-2 text-sm text-[var(--color-mist)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function MissionStopAsk({
  title,
  busy,
  onKeep,
  onStop,
}: {
  title: string;
  busy?: boolean;
  onKeep: () => void;
  onStop: () => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-[var(--color-ember)]/35 bg-[var(--color-ember)]/[0.08] px-3 py-3">
      <p className="text-sm text-white">Stop “{title}”?</p>
      <p className="mt-1 text-xs text-[var(--color-mist)]">
        It leaves Today. Days you already marked stay in Stats.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onKeep}
          className="rounded-full border border-white/15 px-3.5 py-1.5 text-sm text-white"
        >
          Keep it
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onStop}
          className="rounded-full border border-[var(--color-ember)]/50 px-3.5 py-1.5 text-sm text-[var(--color-ember)]"
        >
          {busy ? "Stopping…" : "Stop mission"}
        </button>
      </div>
    </div>
  );
}

export function payloadFromDraft(draft: MissionDraft) {
  const days = draft.ongoing
    ? 0
    : draft.startDate && draft.endDate
      ? daysFromRange(draft.startDate, draft.endDate)
      : 0;
  return {
    title: draft.title.trim().slice(0, 80),
    note: draft.note.trim().slice(0, 200),
    startDate: draft.startDate,
    endDate: draft.ongoing ? "" : draft.endDate,
    days: Math.min(MAX_MISSION_DAYS, days),
    steps: (draft.steps || [])
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_MISSION_STEPS),
  };
}
