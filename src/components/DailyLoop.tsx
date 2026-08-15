"use client";

import Link from "next/link";

type Step = {
  key: string;
  label: string;
  detail: string;
  done: boolean;
  href?: string;
};

export function DailyLoop({ steps }: { steps: Step[] }) {
  const done = steps.filter((s) => s.done).length;
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[15px] font-medium text-white">Daily loop</h2>
        <span className="text-xs tabular-nums text-[var(--color-mist)]">
          {done}/{steps.length} · XP for finishing
        </span>
      </div>
      <ol className="grid grid-cols-4 gap-1 sm:gap-1.5">
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
                className={`mt-1 block truncate text-xs font-semibold ${
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
          const cls = `rounded-xl border px-1.5 py-2 text-left sm:px-2 sm:py-2.5 ${
            s.done
              ? "border-[var(--color-dawn)] bg-[var(--color-dawn)]"
              : "border-white/12 bg-white/[0.03]"
          }`;
          return (
            <li key={s.key}>
              {s.href && !s.done ? (
                <Link href={s.href} className={`${cls} block`}>
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
