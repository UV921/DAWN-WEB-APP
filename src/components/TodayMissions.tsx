"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  formatMissionDay,
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

  async function startQuick(preset: (typeof QUICK)[number]) {
    setBusyId("new");
    const res = await fetch("/api/mission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        kind: preset.kind,
        title: preset.title,
        days: preset.days,
        note: preset.note,
        habitKeys: preset.kind === "run" ? ["wakeEarly"] : [],
      }),
    });
    setBusyId("");
    if (!res.ok) return;
    setCreating(false);
    await load();
  }

  const live = missions.filter((m) => m.active && !m.progress.ended);
  const finished = missions.filter((m) => m.active && m.progress.ended);

  if (!loaded) return null;

  if (!live.length && !creating) {
    return (
      <section className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="ui-kicker text-[var(--color-dawn)]">Mission</p>
            <h2 className="font-display mt-1 text-xl text-white">
              Track a long run
            </h2>
            <p className="mt-1 text-sm text-[var(--color-mist)]">
              Hackathon, exam, a build — it stays on Today so you can mark the
              days you actually worked.
            </p>
          </div>
          <Link
            href="/settings?tab=mission"
            className="shrink-0 text-xs text-[var(--color-dawn)]"
          >
            Full setup
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
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
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[var(--color-dawn)]/30 bg-[var(--color-dawn)]/[0.06] px-4 py-4 sm:px-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="ui-kicker text-[var(--color-dawn)]">
          {live.length > 1 ? "Missions" : "Mission"}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="text-xs text-[var(--color-dawn)]"
          >
            {creating ? "Close" : "New"}
          </button>
          <Link href="/settings?tab=mission" className="text-xs text-[var(--color-mist)]">
            Edit
          </Link>
        </div>
      </div>

      {creating ? (
        <div className="mt-3 flex flex-wrap gap-2">
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
      ) : null}

      <ul className="mt-4 space-y-4">
        {live.map((m) => (
          <li key={m.id}>
            <MissionLiveRow
              mission={m}
              busy={busyId === m.id}
              onCheck={(done) => void checkIn(m.id, done)}
            />
          </li>
        ))}
        {finished.map((m) => (
          <li key={m.id} className="text-sm text-[var(--color-mist)]">
            {m.title} finished · {m.daysWorked} days worked
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MissionLiveRow({
  mission: m,
  busy,
  onCheck,
  showEnd,
  onEnd,
}: {
  mission: MissionPublic;
  busy?: boolean;
  onCheck?: (done: boolean) => void;
  showEnd?: boolean;
  onEnd?: () => void;
}) {
  const p = m.progress;
  const pct = p.ongoing
    ? Math.min(100, p.day > 0 ? 8 : 0)
    : p.total
      ? Math.min(100, Math.round((p.day / p.total) * 100))
      : 0;
  const workPct =
    p.ongoing || !p.total
      ? null
      : Math.round((m.daysWorked / Math.max(1, Math.min(p.day, p.total))) * 100);

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
