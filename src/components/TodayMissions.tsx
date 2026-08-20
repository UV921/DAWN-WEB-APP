"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MissionSteps } from "@/components/MissionSteps";
import { IconChevronDown, IconSettings } from "@/components/icons";
import {
  formatMissionRemaining,
  formatMissionSpan,
  missionRemainPct,
  type MissionPublic,
} from "@/lib/missions";
import {
  MissionEditor,
  MissionStopAsk,
  type MissionDraft,
} from "@/components/MissionEditor";

const EASE = [0.22, 1, 0.36, 1] as const;

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
  const [openId, setOpenId] = useState<string | null>(null);
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
          className="inline-flex shrink-0 items-center gap-1 text-xs text-[var(--color-mist)]"
        >
          <IconSettings size={13} />
          Settings
        </Link>
      </div>

      {err ? <p className="mt-3 text-sm text-red-300">{err}</p> : null}

      {live.length ? (
        <ul className="mt-4 space-y-3">
          {live.map((m) => (
            <li key={m.id}>
              <TodayMissionCard
                mission={m}
                busy={busyId === m.id}
                open={openId === m.id}
                onToggle={() =>
                  setOpenId((prev) => (prev === m.id ? null : m.id))
                }
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
  open,
  onToggle,
  onAddStep,
  onToggleStep,
  onDeleteStep,
}: {
  mission: MissionPublic;
  busy?: boolean;
  open: boolean;
  onToggle: () => void;
  onAddStep?: (text: string) => void;
  onToggleStep?: (id: string, done: boolean) => void;
  onDeleteStep?: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const p = m.progress;
  const remain = missionRemainPct(p);
  const settingsHref = todayMissionSettingsHref(m.id);
  const stepCount = (m.steps || []).length;
  const stepsDone = (m.steps || []).filter((s) => s.done).length;

  return (
    <motion.div
      layout
      className={`overflow-hidden rounded-2xl border bg-black/20 ${
        open
          ? "border-[var(--color-dawn)]/45"
          : "border-white/10"
      }`}
      transition={{ duration: 0.28, ease: EASE }}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left sm:gap-4 sm:px-4"
        >
          <MissionRemainRing
            remain={remain}
            day={p.day}
            ongoing={p.ongoing}
          />
          <div className="min-w-0 flex-1">
            <p className="font-display truncate text-[1.35rem] leading-tight text-white">
              {m.title}
            </p>
            <p className="mt-1 text-sm tabular-nums text-[var(--color-mist)]">
              {p.ongoing
                ? `Day ${p.day}`
                : `Day ${p.day} of ${p.total}`}
              {p.ongoing
                ? " · ongoing"
                : p.daysLeft === 1
                  ? " · last day"
                  : ` · ${p.daysLeft} left`}
            </p>
          </div>
          <motion.span
            className="shrink-0 text-[var(--color-mist)]"
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: EASE }}
          >
            <IconChevronDown size={18} />
          </motion.span>
        </button>
        <Link
          href={settingsHref}
          aria-label={`Open ${m.title} in Settings`}
          className="flex shrink-0 items-center border-l border-white/10 px-3 text-[var(--color-mist)] hover:text-white"
        >
          <IconSettings size={16} />
        </Link>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="steps"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 1 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/8 px-3 pb-3 sm:px-4">
              <p className="pt-3 text-[11px] tabular-nums text-[var(--color-mist)]">
                {stepCount
                  ? `${stepsDone}/${stepCount} steps`
                  : "Add steps for today"}
              </p>
              <MissionSteps
                steps={m.steps || []}
                busy={busy}
                onAdd={onAddStep}
                onToggle={onToggleStep}
                onDelete={onDeleteStep}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

function MissionRemainRing({
  remain,
  day,
  ongoing,
}: {
  remain: number | null;
  day: number;
  ongoing: boolean;
}) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const size = 64;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = ongoing ? 100 : remain ?? 0;
  const offset = c * (1 - pct / 100);
  const gid = `mission-remain-${uid}`;

  return (
    <div
      className="relative h-16 w-16 shrink-0"
      aria-label={
        ongoing
          ? `Day ${day}, ongoing`
          : `${pct} percent remaining, day ${day}`
      }
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="h-16 w-16 -rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-ember)" />
            <stop offset="100%" stopColor="var(--color-dawn)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{
            strokeDashoffset: offset,
            opacity: ongoing ? [0.45, 1, 0.45] : 1,
          }}
          transition={
            ongoing && !reduce
              ? { opacity: { duration: 2.4, repeat: Infinity, ease: "easeInOut" } }
              : { duration: 0.9, ease: EASE }
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        {ongoing ? (
          <>
            <span className="font-display text-[0.95rem] tabular-nums text-white">
              {day}
            </span>
            <span className="mt-0.5 text-[8px] uppercase tracking-[0.14em] text-[var(--color-mist)]">
              day
            </span>
          </>
        ) : (
          <>
            <span className="font-display text-[0.95rem] tabular-nums text-white">
              {pct}
              <span className="text-[0.6rem]">%</span>
            </span>
            <span className="mt-0.5 text-[8px] uppercase tracking-[0.12em] text-[var(--color-mist)]">
              left
            </span>
          </>
        )}
      </div>
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
