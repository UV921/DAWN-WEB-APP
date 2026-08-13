"use client";

import { formatDuration } from "@/lib/habit-windows";

type Props = {
  pledge?: string;
  planWake?: string;
  disabled?: boolean;
  alreadyUp?: boolean;
  windowOpen?: boolean;
  windowStart?: string;
  windowEnd?: string;
  opensInMin?: number;
  onRise: () => void | Promise<void>;
};

/** Compact wake check-in — doesn’t block tasks. */
export function MorningRitual({
  pledge,
  planWake,
  disabled,
  alreadyUp,
  windowOpen = false,
  windowStart,
  windowEnd,
  opensInMin,
  onRise,
}: Props) {
  if (alreadyUp) return null;

  if (!windowOpen) {
    return (
      <p className="text-sm text-[var(--color-mist)]">
        Wake check-in{" "}
        {windowStart && windowEnd ? `${windowStart}–${windowEnd}` : "later"}
        {typeof opensInMin === "number" && opensInMin > 0
          ? ` · opens in ${formatDuration(opensInMin)}`
          : ""}
        {" · "}
        <a href="/settings?tab=morning" className="text-white/80 underline-offset-2 hover:underline">
          change
        </a>
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => void onRise()}
        className="ui-btn ui-btn-primary w-full"
      >
        I’m awake{planWake ? ` · ${planWake}` : ""}
      </button>
      {pledge ? (
        <p className="mt-2 text-center text-xs text-[var(--color-mist)]">
          {pledge}
        </p>
      ) : null}
    </div>
  );
}
