"use client";

import { useState } from "react";
import { IconX } from "@/components/icons";
import { MAX_MISSION_STEPS, type MissionStepPublic } from "@/lib/missions";

export function MissionSteps({
  steps,
  busy,
  onAdd,
  onToggle,
  onDelete,
}: {
  steps: MissionStepPublic[];
  busy?: boolean;
  onAdd: (text: string) => void;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const done = steps.filter((s) => s.done).length;

  function submit() {
    const text = draft.trim();
    if (!text || busy) return;
    if (steps.length >= MAX_MISSION_STEPS) return;
    onAdd(text);
    setDraft("");
  }

  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-mist)]">
          Steps
        </p>
        {steps.length ? (
          <p className="text-[11px] tabular-nums text-[var(--color-mist)]">
            {done}/{steps.length}
          </p>
        ) : null}
      </div>
      {steps.length ? (
        <ul className="mt-1">
          {steps.map((s) => (
            <li key={s.id} className="group/sub flex items-center gap-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => onToggle(s.id, !s.done)}
                className="flex min-h-9 min-w-0 flex-1 items-center gap-2 py-1 text-left"
                aria-label={s.done ? `Undo ${s.text}` : `Complete ${s.text}`}
              >
                <span className={`ui-check !h-4 !w-4 ${s.done ? "is-on" : ""}`}>
                  ✓
                </span>
                <span
                  className={`min-w-0 flex-1 text-[13px] leading-snug ${
                    s.done
                      ? "text-[var(--color-mist)] line-through"
                      : "text-[#d6e2ec]"
                  }`}
                >
                  {s.text}
                </span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDelete(s.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center text-[var(--color-mist)] opacity-70 hover:text-white md:opacity-0 md:group-hover/sub:opacity-100"
                aria-label={`Remove ${s.text}`}
              >
                <IconX size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 py-1 text-[13px] text-[var(--color-mist)]">
          Break this into steps.
        </p>
      )}
      {steps.length < MAX_MISSION_STEPS ? (
        <form
          className="mt-1 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a step"
            className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-[13px] text-white outline-none placeholder:text-[var(--color-mist)]"
            autoComplete="off"
            maxLength={120}
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="text-[12px] font-medium text-[var(--color-dawn)] disabled:opacity-40"
          >
            Add
          </button>
        </form>
      ) : (
        <p className="mt-1 text-[11px] text-[var(--color-mist)]">
          Max {MAX_MISSION_STEPS} steps.
        </p>
      )}
    </div>
  );
}
