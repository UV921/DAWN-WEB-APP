"use client";

import type { LifeBrief } from "@/lib/personal-life";

export function PersonalBriefCard({
  brief,
  empty,
}: {
  brief: LifeBrief | null;
  empty?: boolean;
}) {
  if (!brief && empty) {
    return (
      <section className="rounded-2xl border border-dashed border-white/20 bg-white/[0.02] px-5 py-5">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-dawn)]">
          Your life, not a template
        </p>
        <p className="font-display mt-2 text-2xl text-white">
          Tell Dawn who you actually are
        </p>
        <p className="mt-2 text-sm text-[var(--color-mist)]">
          Deep questions about work, home, nights, and why mornings matter —
          then this page becomes yours.
        </p>
        <a
          href="/settings?tab=habits"
          className="ui-btn ui-btn-primary mt-4"
        >
          Answer personal questions
        </a>
      </section>
    );
  }

  if (!brief) return null;

  return (
    <section className="steel-plate rounded-2xl bg-[var(--color-dawn)]/[0.05] px-5 py-5">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-dawn)]">
        Built for you
      </p>
      <h2 className="font-display mt-2 text-2xl text-white md:text-3xl">
        {brief.headline}
      </h2>
      <p className="mt-3 text-[var(--color-cloud)] leading-relaxed">
        {brief.todayAngle}
      </p>
      <p className="mt-2 text-sm text-[var(--color-mist)] leading-relaxed">
        {brief.nightAngle}
      </p>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <p>
          <span className="text-[var(--color-mist)]">Focus · </span>
          <span className="text-[var(--color-leaf)]">{brief.focus}</span>
        </p>
        {brief.avoid ? (
          <p>
            <span className="text-[var(--color-mist)]">Don’t push · </span>
            <span className="text-white/80">{brief.avoid}</span>
          </p>
        ) : null}
      </div>
      {brief.anchors?.length ? (
        <ul className="mt-4 space-y-1.5 border-t border-white/10 pt-4">
          {brief.anchors.slice(0, 4).map((a) => (
            <li key={a} className="text-sm text-[var(--color-mist)]">
              · {a}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
