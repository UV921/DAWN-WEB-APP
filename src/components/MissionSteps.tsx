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
  onAdd?: (text: string) => void;
  onToggle?: (id: string, done: boolean) => void;
  onDelete?: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const done = steps.filter((s) => s.done).length;
  const canAdd = Boolean(onAdd) && steps.length < MAX_MISSION_STEPS;

  if (!steps.length && !onAdd) return null;

  function submit() {
    const text = draft.trim();
    if (!text || busy || !onAdd) return;
    if (steps.length >= MAX_MISSION_STEPS) return;
    onAdd(text);
    setDraft("");
  }

  return (
    <div className="mt-3 rounded-2xl border border-white/12 bg-black/25 px-3 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-dawn)]">
          Steps
        </p>
        <p className="text-[11px] tabular-nums text-[var(--color-mist)]">
          {steps.length ? `${done}/${steps.length}` : "Checklist"}
        </p>
      </div>

      {steps.length ? (
        <ul className="mt-1">
          {steps.map((s) => (
            <li key={s.id} className="group/sub flex items-center gap-1">
              <button
                type="button"
                disabled={busy || !onToggle}
                onClick={() => onToggle?.(s.id, !s.done)}
                className="flex min-h-10 min-w-0 flex-1 items-center gap-2 py-1 text-left disabled:opacity-80"
                aria-label={s.done ? `Undo ${s.text}` : `Complete ${s.text}`}
              >
                <span className={`ui-check !h-4 !w-4 ${s.done ? "is-on" : ""}`}>
                  ✓
                </span>
                <span
                  className={`min-w-0 flex-1 text-[14px] leading-snug ${
                    s.done
                      ? "text-[var(--color-mist)] line-through"
                      : "text-white"
                  }`}
                >
                  {s.text}
                </span>
              </button>
              {onDelete ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDelete(s.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center text-[var(--color-mist)] opacity-80 hover:text-white md:opacity-0 md:group-hover/sub:opacity-100"
                  aria-label={`Remove ${s.text}`}
                >
                  <IconX size={12} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 py-1 text-[13px] text-[var(--color-mist)]">
          Break this into steps — same as a task.
        </p>
      )}

      {canAdd ? (
        <form
          className="mt-2 flex items-center gap-1 rounded-xl border border-white/12 bg-white/[0.04] py-1 pl-3 pr-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a step"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-[13px] text-white outline-none placeholder:text-[var(--color-mist)]"
            autoComplete="off"
            maxLength={120}
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="rounded-lg px-2.5 py-1 text-[12px] font-medium text-[var(--color-dawn)] disabled:opacity-40"
          >
            Add
          </button>
        </form>
      ) : steps.length >= MAX_MISSION_STEPS ? (
        <p className="mt-2 text-[11px] text-[var(--color-mist)]">
          Max {MAX_MISSION_STEPS} steps.
        </p>
      ) : null}
    </div>
  );
}
