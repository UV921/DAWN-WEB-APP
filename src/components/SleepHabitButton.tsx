"use client";

import { useState } from "react";
import { formatDuration } from "@/lib/habit-windows";

type Props = {
  label?: string;
  inWindow: boolean;
  windowLabel?: string;
  opensInMin?: number;
  disabled?: boolean;
  onSleep: () => void | Promise<void>;
};

/** Tap the sleep habit — logs bedtime and closes the night right away. */
export function SleepHabitButton({
  label = "Sleep early",
  inWindow,
  windowLabel,
  opensInMin,
  disabled,
  onSleep,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function tap() {
    if (!inWindow || busy || disabled) return;
    setBusy(true);
    try {
      await onSleep();
    } finally {
      setBusy(false);
    }
  }

  const locked = !inWindow;
  const hint = locked
    ? typeof opensInMin === "number" && opensInMin > 0
      ? `Opens in ${formatDuration(opensInMin)}`
      : windowLabel
        ? `Opens ${windowLabel}`
        : "Not in the sleep window yet"
    : busy
      ? "Closing the night…"
      : "Tap to close the night";

  return (
    <button
      type="button"
      onClick={() => void tap()}
      disabled={disabled || busy || locked}
      className={`ui-row w-full ${locked ? "is-locked" : ""}`}
    >
      <span className="ui-check">✓</span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block font-medium text-white">{label}</span>
        <span className="mt-0.5 block text-xs text-[var(--color-mist)]">
          {hint}
        </span>
      </span>
    </button>
  );
}
