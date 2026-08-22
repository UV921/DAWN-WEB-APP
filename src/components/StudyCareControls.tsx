"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  formatStudyNudgeInterval,
  STUDY_NUDGE_PRESETS,
  type StudyNudgeRow,
} from "@/lib/study-nudges";

export function StudyCareControls({ live }: { live: boolean }) {
  const [nudges, setNudges] = useState<StudyNudgeRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/study-nudges", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setNudges(data.nudges || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function seed() {
    setBusy(true);
    await fetch("/api/study-nudges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed: true }),
    });
    setBusy(false);
    setOpen(true);
    await load();
  }

  async function toggle(id: string, enabled: boolean) {
    setBusy(true);
    await fetch("/api/study-nudges", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
    setBusy(false);
    await load();
  }

  async function setIntervalMinutes(id: string, intervalMinutes: number) {
    setBusy(true);
    await fetch("/api/study-nudges", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, intervalMinutes }),
    });
    setBusy(false);
    await load();
  }

  const on = nudges.filter((n) => n.enabled);
  const summary =
    on.length === 0
      ? "Off"
      : on
          .map((n) => `${n.title} ${formatStudyNudgeInterval(n.intervalMinutes)}`)
          .join(" · ");

  return (
    <div className="mt-3 border-t border-white/8 pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-mist)]">
          Care pings
        </span>
        <span className="truncate text-xs text-[var(--color-dawn)]">
          {summary}
        </span>
      </button>
      {open ? (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-[var(--color-mist)]">
            {live
              ? "Pings Discord and this browser on your interval — even if Dawn is in the background."
              : "Set these now. They start once a session is live."}
          </p>
          {nudges.length === 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void seed()}
              className="ui-btn ui-btn-primary !min-h-9 !px-4 text-[12px]"
            >
              Add water + eyes
            </button>
          ) : (
            <ul className="space-y-1.5">
              {nudges.map((n) => (
                <li
                  key={n.id}
                  className="flex flex-wrap items-center gap-2 text-sm text-white"
                >
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void toggle(n.id, !n.enabled)}
                    className={`ui-chip ${n.enabled ? "is-on" : ""}`}
                  >
                    {n.title}
                  </button>
                  <label className="flex items-center gap-1 text-xs text-[var(--color-mist)]">
                    every
                    <input
                      type="number"
                      min={1}
                      max={720}
                      disabled={busy || !n.enabled}
                      defaultValue={n.intervalMinutes}
                      key={`${n.id}-${n.intervalMinutes}`}
                      onBlur={(e) => {
                        const next = Number(e.target.value) || 1;
                        if (next !== n.intervalMinutes) {
                          void setIntervalMinutes(n.id, next);
                        }
                      }}
                      className="w-14 rounded-lg border border-white/15 bg-white/5 px-1.5 py-1 text-xs text-white"
                    />
                    min
                  </label>
                </li>
              ))}
            </ul>
          )}
          {nudges.length > 0 &&
          STUDY_NUDGE_PRESETS.some(
            (p) => !nudges.some((n) => n.presetKey === p.key)
          ) ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void seed()}
              className="text-xs text-[var(--color-dawn)]"
            >
              Add missing presets
            </button>
          ) : null}
          <Link
            href="/settings?tab=reminders"
            className="block text-xs text-[var(--color-dawn)]"
          >
            Edit messages & hours in Settings
          </Link>
        </div>
      ) : null}
    </div>
  );
}
