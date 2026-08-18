"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  formatMissionDay,
  MAX_MISSION_DAYS,
  type MissionKind,
  type MissionPublic,
} from "@/lib/missions";

const QUICK: {
  kind: MissionKind;
  title: string;
  days: number;
  note: string;
}[] = [
  {
    kind: "manual",
    title: "Hackathon",
    days: 3,
    note: "Ship the build. Mark a day when you put hours in.",
  },
  {
    kind: "manual",
    title: "Weekend build",
    days: 2,
    note: "Two days, one thing finished.",
  },
  {
    kind: "manual",
    title: "Long mission",
    days: 0,
    note: "Open-ended — stays on Today until you end it.",
  },
  {
    kind: "run",
    title: "Morning mission",
    days: 7,
    note: "Wake early and the habits you pick, for a week.",
  },
];

type Props = {
  missions?: MissionPublic[];
  onChange?: (missions: MissionPublic[]) => void;
};

export function TodayMissions({ missions: incoming, onChange }: Props) {
  const [missions, setMissions] = useState<MissionPublic[]>(incoming || []);
  const [loaded, setLoaded] = useState(Boolean(incoming));
  const [busyId, setBusyId] = useState("");
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");

  const apply = useCallback(
    (next: MissionPublic[]) => {
      setMissions(next);
      onChange?.(next);
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
    if (incoming) {
      setMissions(incoming);
      setLoaded(true);
      return;
    }
    void load();
  }, [incoming, load]);

  async function checkIn(id: string, done: boolean) {
    setBusyId(id);
    const res = await fetch("/api/mission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check", missionId: id, done }),
    });
    setBusyId("");
    if (!res.ok) return;
    const data = await res.json();
    const updated = data.mission as MissionPublic | null;
    if (!updated) {
      await load();
      return;
    }
    apply(missions.map((m) => (m.id === updated.id ? updated : m)));
  }

  async function startMission(opts: {
    kind?: MissionKind;
    title: string;
    days: number;
    note?: string;
  }) {
    setErr("");
    setBusyId("new");
    const kind = opts.kind || "manual";
    const res = await fetch("/api/mission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        kind,
        title: opts.title,
        days: opts.days,
        note: opts.note || "",
        habitKeys: kind === "run" ? ["wakeEarly"] : [],
      }),
    });
    setBusyId("");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr(String(body.error || "Could not start mission."));
      return;
    }
    setCreating(false);
    await load();
  }

  async function startQuick(preset: (typeof QUICK)[number]) {
    await startMission({
      kind: preset.kind,
      title: preset.title,
      days: preset.days,
      note: preset.note,
    });
  }

  async function setDays(id: string, days: number) {
    setBusyId(id);
    const res = await fetch("/api/mission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-days", missionId: id, days }),
    });
    setBusyId("");
    if (!res.ok) return;
    const data = await res.json();
    const updated = data.mission as MissionPublic | null;
    if (!updated) {
      await load();
      return;
    }
    apply(missions.map((m) => (m.id === updated.id ? updated : m)));
  }

  const live = missions.filter((m) => m.active && !m.progress.ended);
  const finished = missions.filter((m) => m.active && m.progress.ended);
  const showStart = !live.length || creating;

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
        <div>
          <p className="ui-kicker text-[var(--color-dawn)]">
            {live.length > 1 ? "Missions" : "Mission"}
          </p>
          {!live.length ? (
            <>
              <h2 className="font-display mt-1 text-xl text-white">
                Track a long run
              </h2>
              <p className="mt-1 text-sm text-[var(--color-mist)]">
                Type how many days, or pick a preset. It stays on Today so you
                can mark the days you actually worked.
              </p>
            </>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-3">
          {live.length ? (
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              className="text-xs text-[var(--color-dawn)]"
            >
              {creating ? "Close" : "New"}
            </button>
          ) : null}
          <Link
            href="/settings?tab=mission"
            className="text-xs text-[var(--color-dawn)]"
          >
            {live.length ? "Edit" : "Full setup"}
          </Link>
        </div>
      </div>

      {showStart ? (
        <div className="mt-4 space-y-3">
          <MissionCustomStart
            busy={busyId === "new"}
            onStart={(opts) => void startMission(opts)}
          />
          <div className="flex flex-wrap gap-2">
            {QUICK.map((p) => (
              <button
                key={p.title}
                type="button"
                disabled={busyId === "new"}
                onClick={() => void startQuick(p)}
                className="rounded-full border border-white/15 px-3.5 py-1.5 text-sm text-white"
              >
                {p.title}
                {p.days ? ` · ${p.days}d` : " · ongoing"}
              </button>
            ))}
          </div>
          {err ? <p className="text-sm text-red-300">{err}</p> : null}
        </div>
      ) : null}

      {live.length || finished.length ? (
        <ul className={`space-y-4 ${showStart ? "mt-5" : "mt-4"}`}>
          {live.map((m) => (
            <li key={m.id}>
              <MissionLiveRow
                mission={m}
                busy={busyId === m.id}
                onCheck={(done) => void checkIn(m.id, done)}
                onSetDays={(days) => void setDays(m.id, days)}
              />
            </li>
          ))}
          {finished.map((m) => (
            <li key={m.id} className="text-sm text-[var(--color-mist)]">
              {m.title} finished · {m.daysWorked} days worked
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function MissionCustomStart({
  busy,
  defaultTitle = "",
  onStart,
}: {
  busy?: boolean;
  defaultTitle?: string;
  onStart: (opts: { title: string; days: number }) => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [daysText, setDaysText] = useState("");

  function submit() {
    const raw = daysText.trim();
    if (!raw) return;
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n) || n < 1) return;
    onStart({
      title: title.trim() || `${Math.min(MAX_MISSION_DAYS, n)}-day mission`,
      days: Math.min(MAX_MISSION_DAYS, Math.max(1, n)),
    });
  }

  return (
    <div className="rounded-xl border border-white/12 bg-black/20 px-3 py-3">
      <p className="text-xs text-[var(--color-mist)]">Your own days</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Name — Hackathon, exam, build"
          className="ui-field flex-1 !px-3 !py-2 text-sm"
        />
        <div className="flex gap-2">
          <label className="relative flex min-w-[7.5rem] items-center">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_MISSION_DAYS}
              value={daysText}
              onChange={(e) => setDaysText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Days"
              className="ui-field w-full !px-3 !py-2 pr-12 text-sm"
            />
            <span className="pointer-events-none absolute right-3 text-xs text-[var(--color-mist)]">
              days
            </span>
          </label>
          <button
            type="button"
            disabled={busy || !daysText.trim()}
            onClick={submit}
            className="ui-btn ui-btn-primary !px-4 !py-2 text-sm"
          >
            {busy ? "Starting…" : "Start"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MissionLiveRow({
  mission: m,
  busy,
  onCheck,
  onSetDays,
  showEnd,
  onEnd,
}: {
  mission: MissionPublic;
  busy?: boolean;
  onCheck?: (done: boolean) => void;
  onSetDays?: (days: number) => void;
  showEnd?: boolean;
  onEnd?: () => void;
}) {
  const p = m.progress;
  const [daysText, setDaysText] = useState(
    p.ongoing ? "" : String(m.days || p.total || "")
  );
  useEffect(() => {
    setDaysText(p.ongoing ? "" : String(m.days || p.total || ""));
  }, [m.days, p.ongoing, p.total]);
  const pct = p.ongoing
    ? Math.min(100, p.day > 0 ? 8 : 0)
    : p.total
      ? Math.min(100, Math.round((p.day / p.total) * 100))
      : 0;
  const workPct =
    p.ongoing || !p.total
      ? null
      : Math.round((m.daysWorked / Math.max(1, Math.min(p.day, p.total))) * 100);

  function saveDays() {
    if (!onSetDays) return;
    const raw = daysText.trim();
    if (!raw) {
      onSetDays(0);
      return;
    }
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n) || n < 1) return;
    onSetDays(Math.min(MAX_MISSION_DAYS, n));
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl leading-tight text-white">
            {m.title}
          </p>
          <p className="mt-0.5 text-sm text-[var(--color-mist)]">
            {formatMissionDay(p)}
            {m.kind === "manual"
              ? ` · ${m.daysWorked} day${m.daysWorked === 1 ? "" : "s"} worked`
              : ""}
            {workPct != null && m.kind === "manual" ? ` · ${workPct}%` : ""}
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
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/30">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--color-ember)] to-[var(--color-dawn)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      {onSetDays ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--color-mist)]">Length</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_MISSION_DAYS}
            value={daysText}
            onChange={(e) => setDaysText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveDays();
              }
            }}
            placeholder="Ongoing"
            className="ui-field w-24 !px-3 !py-1.5 text-sm"
          />
          <span className="text-xs text-[var(--color-mist)]">days</span>
          <button
            type="button"
            disabled={busy}
            onClick={saveDays}
            className="rounded-full border border-white/15 px-3 py-1 text-xs text-white"
          >
            Save
          </button>
        </div>
      ) : null}
      {m.note ? (
        <p className="mt-2 text-xs text-[var(--color-mist)]">{m.note}</p>
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
      {m.taskTemplates?.length ? (
        <p className="mt-2 text-xs text-[var(--color-mist)]">
          Daily tasks: {m.taskTemplates.join(" · ")}
        </p>
      ) : null}
      {showEnd && onEnd ? (
        <button
          type="button"
          onClick={onEnd}
          className="mt-3 text-xs text-[var(--color-mist)]"
        >
          End mission
        </button>
      ) : null}
    </div>
  );
}
