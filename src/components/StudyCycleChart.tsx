"use client";

import { useId, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { formatStudyDuration } from "@/lib/study-time";
import {
  formatHourLabel,
  formatHourRange,
  studyCycleInsight,
  type HourMinutes,
} from "@/lib/study-cycle";
import type { ReportRange } from "@/lib/progress-brief";

type Props = {
  hours: HourMinutes;
  range: ReportRange;
  nowHour?: number | null;
};

const CX = 120;
const CY = 120;
const R0 = 40;
const R1 = 82;
const GAP = 0.012;

function polar(r: number, angle: number) {
  return {
    x: CX + r * Math.sin(angle),
    y: CY - r * Math.cos(angle),
  };
}

function wedgePath(hour: number) {
  const step = (Math.PI * 2) / 24;
  const a0 = hour * step + GAP;
  const a1 = (hour + 1) * step - GAP;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p0 = polar(R1, a0);
  const p1 = polar(R1, a1);
  const p2 = polar(R0, a1);
  const p3 = polar(R0, a0);
  return `M ${p0.x} ${p0.y} A ${R1} ${R1} 0 ${large} 1 ${p1.x} ${p1.y} L ${p2.x} ${p2.y} A ${R0} ${R0} 0 ${large} 0 ${p3.x} ${p3.y} Z`;
}

function hourFill(minutes: number, max: number, isPeak: boolean) {
  if (minutes <= 0 || max <= 0) return "rgba(255,255,255,0.06)";
  const t = Math.max(0.18, Math.min(1, minutes / max));
  if (isPeak) return `rgba(240, 180, 90, ${0.28 + t * 0.62})`;
  return `rgba(110, 168, 216, ${0.22 + t * 0.68})`;
}

function rangeCaption(range: ReportRange) {
  if (range === "today") return "today";
  if (range === "week") return "the last 7 days";
  if (range === "month") return "the last 30 days";
  return "the last 365 days";
}

const CLOCK_TICKS = [
  { hour: 0, label: "12am" },
  { hour: 6, label: "6am" },
  { hour: 12, label: "12pm" },
  { hour: 18, label: "6pm" },
];

export function StudyCycleChart({ hours, range, nowHour = null }: Props) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const insight = useMemo(() => studyCycleInsight(hours), [hours]);
  const max = Math.max(0, ...hours);
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? insight.peakHour;
  const activeMinutes = active != null ? hours[active] || 0 : 0;
  const peakStart = insight.peakWindow?.start ?? null;
  const peakHours = new Set(
    insight.peakWindow
      ? [0, 1, 2].map((k) => (insight.peakWindow!.start + k) % 24)
      : insight.peakHour != null
        ? [insight.peakHour]
        : []
  );

  return (
    <div>
      <h2 className="font-display text-2xl text-white">When you study</h2>
      <p className="mt-1 text-sm text-[var(--color-mist)]">
        A 24-hour cycle for {rangeCaption(range)}. Bright wedges are when you
        sit down. Dim ones are when you don’t.
      </p>

      <div className="mt-5 grid gap-6 sm:grid-cols-[minmax(0,240px)_1fr] sm:items-center">
        <div className="relative mx-auto w-[240px]">
          <svg
            viewBox="0 0 240 240"
            className="h-auto w-full"
            role="img"
            aria-label={insight.headline}
          >
            <defs>
              <radialGradient id={`cycle-hole-${uid}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(13,27,42,0.9)" />
                <stop offset="100%" stopColor="rgba(7,16,24,0.4)" />
              </radialGradient>
            </defs>
            <circle
              cx={CX}
              cy={CY}
              r={R1 + 8}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
            <circle cx={CX} cy={CY} r={R0 - 2} fill={`url(#cycle-hole-${uid})`} />
            {hours.map((minutes, hour) => {
              const isPeak = peakHours.has(hour);
              const isActive = active === hour;
              return (
                <motion.path
                  key={hour}
                  d={wedgePath(hour)}
                  fill={hourFill(minutes, max, isPeak)}
                  stroke={
                    isActive
                      ? "rgba(240,180,90,0.9)"
                      : minutes > 0
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(255,255,255,0.04)"
                  }
                  strokeWidth={isActive ? 1.6 : 0.6}
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: reduce ? 0 : hour * 0.012, duration: 0.35 }}
                  className="cursor-pointer"
                  onMouseEnter={() => setHover(hour)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(hour)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  role="img"
                  aria-label={`${formatHourLabel(hour)} · ${formatStudyDuration(minutes)}`}
                />
              );
            })}
            {CLOCK_TICKS.map((tick) => {
              const angle = (tick.hour / 24) * Math.PI * 2;
              const inner = polar(R1 + 8, angle);
              const outer = polar(R1 + 14, angle);
              const label = polar(R1 + 26, angle);
              return (
                <g key={tick.hour}>
                  <line
                    x1={inner.x}
                    y1={inner.y}
                    x2={outer.x}
                    y2={outer.y}
                    stroke="rgba(255,255,255,0.28)"
                    strokeWidth={1.2}
                  />
                  <text
                    x={label.x}
                    y={label.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="rgba(139,163,184,0.95)"
                    fontSize="9"
                    fontFamily="var(--font-body), system-ui, sans-serif"
                  >
                    {tick.label}
                  </text>
                </g>
              );
            })}
            {nowHour != null && nowHour >= 0 && nowHour < 24 ? (
              <line
                x1={polar(R0 + 2, ((nowHour + 0.5) / 24) * Math.PI * 2).x}
                y1={polar(R0 + 2, ((nowHour + 0.5) / 24) * Math.PI * 2).y}
                x2={polar(R1 + 4, ((nowHour + 0.5) / 24) * Math.PI * 2).x}
                y2={polar(R1 + 4, ((nowHour + 0.5) / 24) * Math.PI * 2).y}
                stroke="var(--color-leaf)"
                strokeWidth={2}
                strokeLinecap="round"
              />
            ) : null}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--color-mist)]">
              {hover != null ? formatHourLabel(hover) : "Peak"}
            </p>
            <p className="font-display mt-0.5 text-lg leading-none text-white">
              {hover != null
                ? formatStudyDuration(activeMinutes)
                : insight.peakWindow
                  ? formatHourRange(insight.peakWindow.start, insight.peakWindow.end)
                  : "—"}
            </p>
          </div>
        </div>

        <div>
          <p className="font-display text-xl leading-snug text-white">
            {insight.headline}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-cloud)]">
            {insight.body}
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-2">
            {insight.bands.map((band) => {
              const on = insight.peakBand?.key === band.key && band.minutes > 0;
              return (
                <li
                  key={band.key}
                  className={`rounded-xl border px-3 py-2.5 ${
                    on
                      ? "border-[var(--color-dawn)]/40 bg-[var(--color-dawn)]/[0.08]"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-mist)]">
                    {band.label}
                    <span className="ml-1 normal-case tracking-normal">
                      {band.hint}
                    </span>
                  </p>
                  <p className="mt-0.5 font-display text-lg text-white">
                    {band.minutes > 0 ? formatStudyDuration(band.minutes) : "—"}
                    {band.minutes > 0 ? (
                      <span className="ml-1.5 font-sans text-xs text-[var(--color-mist)]">
                        {band.pct}%
                      </span>
                    ) : null}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex h-[88px] items-end gap-px sm:gap-0.5">
          {hours.map((minutes, hour) => {
            const h = max > 0 ? Math.max(minutes > 0 ? 6 : 3, Math.round((minutes / max) * 84)) : 3;
            const isPeak = peakHours.has(hour);
            const isActive = active === hour;
            const isNow = nowHour === hour;
            return (
              <button
                key={hour}
                type="button"
                className={`min-w-0 flex-1 rounded-t-sm ${
                  isActive
                    ? "bg-[var(--color-dawn)]"
                    : isPeak
                      ? "bg-[var(--color-dawn)]/70"
                      : minutes > 0
                        ? "bg-[#6ea8d8]/80"
                        : "bg-white/10"
                } ${isNow ? "ring-1 ring-[var(--color-leaf)]" : ""}`}
                style={{ height: h }}
                title={`${formatHourLabel(hour)} · ${formatStudyDuration(minutes)}`}
                aria-label={`${formatHourLabel(hour)} · ${formatStudyDuration(minutes)}`}
                onMouseEnter={() => setHover(hour)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(hour)}
                onBlur={() => setHover(null)}
              />
            );
          })}
        </div>
        <div className="mt-1.5 flex justify-between px-0.5 text-[10px] text-[var(--color-mist)]">
          <span>12am</span>
          <span>6am</span>
          <span>12pm</span>
          <span>6pm</span>
          <span>12am</span>
        </div>
        {insight.peakWindow && insight.total > 0 ? (
          <p className="mt-2 text-xs text-[var(--color-mist)]">
            Gold is your heaviest {formatHourRange(peakStart ?? 0, insight.peakWindow.end)}{" "}
            block. Blue is the rest of the day.
            {nowHour != null ? " The green mark is now." : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}
