"use client";

import { useEffect, useState } from "react";
import { STUDY_ACTIVITY_PRESETS } from "@/lib/study-activity";

export function StudyActivityControls({
  live,
  source,
  activity,
  activityKey,
  busy,
  error,
  onPick,
  onCustom,
  onStart,
  onStop,
}: {
  live: boolean;
  source?: "discord" | "web" | null;
  activity?: string | null;
  activityKey?: string | null;
  busy?: boolean;
  error?: string | null;
  onPick: (key: string) => void;
  onCustom: (text: string) => void;
  onStart: () => void;
  onStop: () => void;
}) {
  const [writeOpen, setWriteOpen] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (activityKey === "custom" && activity) setNote(activity);
  }, [activity, activityKey]);

  const customOn =
    writeOpen || activityKey === "custom" || Boolean(activity && !activityKey);

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-mist)]">
        {live ? "What you’re doing" : "Start here, or join Discord"}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {STUDY_ACTIVITY_PRESETS.map((p) => {
          const on = !writeOpen && activityKey === p.key;
          return (
            <button
              key={p.key}
              type="button"
              disabled={busy}
              onClick={() => {
                setWriteOpen(false);
                onPick(p.key);
              }}
              className={`ui-chip ${on ? "is-on" : ""}`}
            >
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          disabled={busy}
          onClick={() => setWriteOpen(true)}
          className={`ui-chip ${customOn ? "is-on" : ""}`}
        >
          Write it…
        </button>
      </div>
      {writeOpen ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const text = note.trim();
            if (!text) return;
            onCustom(text);
            setWriteOpen(false);
          }}
        >
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={80}
            placeholder="What are you doing?"
            className="ui-field flex-1 text-sm"
            autoFocus
          />
          <button
            type="submit"
            disabled={busy || !note.trim()}
            className="ui-btn ui-btn-primary !min-h-10 !px-4 text-[13px] disabled:opacity-50"
          >
            {live ? "Save" : "Start"}
          </button>
        </form>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {live ? (
          source === "web" ? (
            <button
              type="button"
              disabled={busy}
              onClick={onStop}
              className="ui-btn ui-btn-ghost !min-h-9 !px-4 text-[12px]"
            >
              Stop
            </button>
          ) : (
            <p className="text-xs text-[var(--color-mist)]">
              Leave the study VC to stop. Discord pinged you too.
            </p>
          )
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={onStart}
            className="ui-btn ui-btn-primary !min-h-9 !px-4 text-[12px]"
          >
            Start session
          </button>
        )}
      </div>
      {error ? (
        <p className="text-xs text-[var(--color-ember)]">{error}</p>
      ) : null}
    </div>
  );
}
