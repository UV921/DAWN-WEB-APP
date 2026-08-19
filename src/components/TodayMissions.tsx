"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { MissionSteps } from "@/components/MissionSteps";
import {
  formatMissionRemaining,
  formatMissionSpan,
  type MissionPublic,
} from "@/lib/missions";
import {
  MissionEditor,
  MissionStopAsk,
  type MissionDraft,
} from "@/components/MissionEditor";

type Props = {
  missions?: MissionPublic[];
  onChange?: (missions: MissionPublic[]) => void;
};

export function todayMissionSettingsHref(id?: string) {
  return id
    ? `/settings?tab=mission&mission=${encodeURIComponent(id)}`
    : "/settings?tab=mission";
}

export function TodayMissions({ missions: incoming, onChange }: Props) {
  const [missions, setMissions] = useState<MissionPublic[]>(incoming || []);
  const [loaded, setLoaded] = useState(Boolean(incoming));
  const [busyId, setBusyId] = useState("");
  const [err, setErr] = useState("");

  const apply = useCallback(
    (next: MissionPublic[] | ((prev: MissionPublic[]) => MissionPublic[])) => {
      setMissions((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        onChange?.(resolved);
        return resolved;
      });
    },
    [onChange]
  );

  const load = useCallback(async () => {
    const res = await fetch("/api/mission");
    if (!res.ok) {
      setLoaded(true);
      return;
    }
    const data = await res.json();
    apply((data.missions || []) as MissionPublic[]);
    setLoaded(true);
  }, [apply]);

  useEffect(() => {
    if (incoming !== undefined) {
      setMissions(incoming);
      setLoaded(true);
      return;
    }
    void load();
  }, [incoming, load]);

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/mission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  async function applyMissionResult(
    ok: boolean,
    data: { mission?: MissionPublic | null; error?: string }
  ) {
    if (!ok) {
      setErr(String(data.error || "Could not update steps."));
      await load();
      return;
    }
    const updated = data.mission as MissionPublic | null;
    if (!updated) {
      await load();
      return;
    }
    apply((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }

  async function addStep(missionId: string, text: string) {
    const tempId = `tmp-${Date.now()}`;
    apply((prev) =>
      prev.map((m) =>
        m.id === missionId
          ? {
              ...m,
              steps: [
                ...(m.steps || []),
                {
                  id: tempId,
                  text,
                  done: false,
                  sortOrder: (m.steps || []).length,
                },
              ],
            }
          : m
      )
    );
    setBusyId(missionId);
    const { ok, data } = await post({ action: "add-step", missionId, text });
    setBusyId("");
    await applyMissionResult(ok, data);
  }

  async function toggleStep(missionId: string, stepId: string, done: boolean) {
    apply((prev) =>
      prev.map((m) =>
        m.id === missionId
          ? {
              ...m,
              steps: (m.steps || []).map((s) =>
                s.id === stepId ? { ...s, done } : s
              ),
            }
          : m
      )
    );
    setBusyId(missionId);
    const { ok, data } = await post({ action: "toggle-step", stepId, done });
    setBusyId("");
    await applyMissionResult(ok, data);
  }

  async function deleteStep(missionId: string, stepId: string) {
    apply((prev) =>
      prev.map((m) =>
        m.id === missionId
          ? { ...m, steps: (m.steps || []).filter((s) => s.id !== stepId) }
          : m
      )
    );
    setBusyId(missionId);
    const { ok, data } = await post({ action: "delete-step", stepId });
    setBusyId("");
    await applyMissionResult(ok, data);
  }

  const live = missions.filter((m) => m.active && !m.progress.ended);

  if (!loaded) return null;

  return (
    <section
      className={
        live.length
          ? "rounded-2xl border border-[var(--color-dawn)]/30 bg-[var(--color-dawn)]/[0.06] px-4 py-4 sm:px-5"
          : "rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-4 sm:px-5"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <p className="ui-kicker text-[var(--color-dawn)]">
          {live.length > 1 ? "Missions" : "Mission"}
        </p>
        <Link
          href={todayMissionSettingsHref()}
          className="shrink-0 text-xs text-[var(--color-mist)]"
        >
          Settings
        </Link>
      </div>

      {err ? <p className="mt-3 text-sm text-red-300">{err}</p> : null}

      {live.length ? (
        <ul className="mt-4 space-y-4">
          {live.map((m) => (
            <li key={m.id}>
              <TodayMissionCard
                mission={m}
                busy={busyId === m.id}
                onAddStep={(text) => void addStep(m.id, text)}
                onToggleStep={(stepId, done) =>
                  void toggleStep(m.id, stepId, done)
                }
                onDeleteStep={(stepId) => void deleteStep(m.id, stepId)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--color-mist)]">
          No mission on Today.{" "}
          <Link
            href={todayMissionSettingsHref()}
            className="text-[var(--color-dawn)]"
          >
            Open Settings
          </Link>{" "}
          to add one.
        </p>
      )}
    </section>
  );
}

function TodayMissionCard({
  mission: m,
  busy,
  onAddStep,
  onToggleStep,
  onDeleteStep,
}: {
  mission: MissionPublic;
  busy?: boolean;
  onAddStep?: (text: string) => void;
  onToggleStep?: (id: string, done: boolean) => void;
  onDeleteStep?: (id: string) => void;
}) {
  const settingsHref = todayMissionSettingsHref(m.id);

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <Link href={settingsHref} className="min-w-0">
          <p className="font-display text-xl leading-tight text-white">
            {m.title}
          </p>
          <p className="mt-0.5 text-sm text-[var(--color-mist)]">
            {formatMissionRemaining(m.progress)}
          </p>
        </Link>
        <Link
          href={settingsHref}
          className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-xs text-white"
          aria-label={`Open ${m.title} in Settings`}
        >
          Settings
        </Link>
      </div>

      <MissionSteps
        steps={m.steps || []}
        busy={busy}
        onAdd={onAddStep}
        onToggle={onToggleStep}
        onDelete={onDeleteStep}
      />
    </div>
  );
}

export function MissionLiveRow({
  mission: m,
  busy,
  editing,
  stopping,
  draft,
  onDraft,
  onCheck,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onAskStop,
  onKeep,
  onStop,
  extra,
  onAddStep,
  onToggleStep,
  onDeleteStep,
}: {
  mission: MissionPublic;
  busy?: boolean;
  editing?: boolean;
  stopping?: boolean;
  draft?: MissionDraft | null;
  onDraft?: (d: MissionDraft) => void;
  onCheck?: (done: boolean) => void;
  onEdit?: () => void;
  onCancelEdit?: () => void;
  onSaveEdit?: () => void;
  onAskStop?: () => void;
  onKeep?: () => void;
  onStop?: () => void;
  extra?: ReactNode;
  onAddStep?: (text: string) => void;
  onToggleStep?: (id: string, done: boolean) => void;
  onDeleteStep?: (id: string) => void;
}) {
  const p = m.progress;
  const pct = p.ongoing
    ? Math.min(100, p.day > 0 ? 8 : 0)
    : p.total
      ? Math.min(100, Math.round((p.day / p.total) * 100))
      : 0;

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl leading-tight text-white">
            {m.title}
          </p>
          <p className="mt-0.5 text-sm text-[var(--color-mist)]">
            {formatMissionRemaining(p)} · {formatMissionSpan(m.startDate, m.endDate)}
            {m.kind === "manual"
              ? ` · ${m.daysWorked} day${m.daysWorked === 1 ? "" : "s"} worked`
              : ""}
            {(m.steps || []).length
              ? ` · ${m.steps.filter((s) => s.done).length}/${m.steps.length} steps`
              : " · 0 steps"}
          </p>
        </div>
        {m.kind === "manual" && p.active && onCheck ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onCheck(!m.doneToday)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm ${
              m.doneToday
                ? "border-[var(--color-leaf)]/50 bg-[var(--color-leaf)]/15 text-[var(--color-leaf)]"
                : "border-white/20 text-white"
            }`}
          >
            {m.doneToday ? "Worked today" : "I worked today"}
          </button>
        ) : null}
      </div>

      <MissionSteps
        steps={m.steps || []}
        busy={busy}
        onAdd={onAddStep}
        onToggle={onToggleStep}
        onDelete={onDeleteStep}
      />

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/30">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--color-ember)] to-[var(--color-dawn)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      {m.note ? (
        <p className="mt-2 text-xs text-[var(--color-mist)]">{m.note}</p>
      ) : null}

      {editing && draft && onDraft ? (
        <div className="mt-3">
          <MissionEditor
            draft={draft}
            onChange={onDraft}
            busy={busy}
            onSave={() => onSaveEdit?.()}
            onCancel={() => onCancelEdit?.()}
          >
            {extra}
          </MissionEditor>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-full border border-white/15 px-3 py-1 text-xs text-white"
            >
              Edit
            </button>
          ) : null}
          {onAskStop ? (
            <button
              type="button"
              onClick={onAskStop}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-[var(--color-mist)]"
            >
              Stop
            </button>
          ) : null}
        </div>
      )}

      {stopping && onKeep && onStop ? (
        <MissionStopAsk
          title={m.title}
          busy={busy}
          onKeep={onKeep}
          onStop={onStop}
        />
      ) : null}

      {m.habitStats?.length ? (
        <ul className="mt-3 space-y-1.5">
          {m.habitStats.map((h) => (
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
    </div>
  );
}
