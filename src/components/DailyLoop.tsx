"use client";

import Link from "next/link";

export type LoopStep = {
  key: string;
  label: string;
  detail: string;
  done: boolean;
  href?: string;
};

export function DailyLoop({ steps }: { steps: LoopStep[] }) {
  const done = steps.filter((s) => s.done).length;
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="ui-section-title text-[1.15rem]">The day</h2>
        <span className="shrink-0 text-xs tabular-nums text-[var(--color-mist)]">
          {done}/{steps.length} done
        </span>
      </div>
      <ol className="day-loop">
        {steps.map((s, i) => {
          const inner = (
            <>
              <span
                className={`text-[10px] uppercase tracking-[0.12em] ${
                  s.done ? "text-[var(--color-night)]/70" : "text-[var(--color-mist)]"
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`mt-1 block truncate text-[13px] font-semibold ${
                  s.done ? "text-[var(--color-night)]" : "text-white"
                }`}
              >
                {s.label}
              </span>
              <span
                className={`mt-0.5 block truncate text-[10px] leading-tight ${
                  s.done ? "text-[var(--color-night)]/70" : "text-[var(--color-mist)]"
                }`}
              >
                {s.detail}
              </span>
            </>
          );
          const cls = `day-loop-step ${
            s.done
              ? "border-[var(--color-dawn)] bg-[var(--color-dawn)]"
              : "border-white/12 bg-white/[0.03]"
          }`;
          return (
            <li key={s.key} className="min-w-0">
              {s.href && !s.done ? (
                <Link href={s.href} className={cls}>
                  {inner}
                </Link>
              ) : (
                <div className={cls}>{inner}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
