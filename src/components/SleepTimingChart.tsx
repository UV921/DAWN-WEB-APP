"use client";

import { useMemo, useState } from "react";
import { isSleepEarly } from "@/lib/habits";
import {
  minutesPastSleepGoal,
  minutesPastWakeGoal,
  minutesToHHMM,
  overnightSpan,
  sleepAxisRange,
  sleepAxisTicks,
  type NightLogReport,
} from "@/lib/sleep-report";

export type SleepTimingNight = Pick<
  NightLogReport,
  "date" | "weekday" | "bedtime" | "wakeTime" | "hours" | "metMin"
>;

type Props = {
  nights: SleepTimingNight[];
  sleepGoal: string;
  wakeGoal: string;
  className?: string;
  /** Chart only — no section title or compare cards. */
  compact?: boolean;
};

function yPct(value: number, start: number, end: number) {
  const span = end - start || 1;
  return Math.max(0, Math.min(100, ((value - start) / span) * 100));
}

function mergeTicks(ticks: number[], extras: number[]) {
  const out = [...extras];
  for (const t of ticks) {
    if (out.some((x) => Math.abs(x - t) < 35)) continue;
    out.push(t);
  }
  return out.sort((a, b) => a - b);
}

function hoursLabel(n: number | null) {
  if (n == null) return "—";
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function deltaCopy(mins: number | null, kind: "bed" | "wake") {
  if (mins == null) return { text: "Not logged", tone: "muted" as const };
  if (Math.abs(mins) <= 5) return { text: "On time", tone: "good" as const };
  if (mins > 0) {
    return {
      text: `${mins} min late`,
      tone: "bad" as const,
    };
  }
  return {
    text: `${Math.abs(mins)} min early`,
    tone: kind === "bed" ? ("good" as const) : ("muted" as const),
  };
}

function toneClass(tone: "good" | "bad" | "muted") {
  if (tone === "good") return "text-[var(--color-leaf)]";
  if (tone === "bad") return "text-[var(--color-ember)]";
  return "text-[var(--color-mist)]";
}

export function SleepTimingChart({
  nights,
  sleepGoal,
  wakeGoal,
  className,
  compact = false,
}: Props) {
  const lastLogged = [...nights]
    .reverse()
    .find((n) => n.bedtime || n.wakeTime);
  const [selectedDate, setSelectedDate] = useState(
    lastLogged?.date ?? nights[nights.length - 1]?.date ?? ""
  );

  const selected =
    nights.find((n) => n.date === selectedDate) ?? lastLogged ?? nights[0];

  const axis = useMemo(() => {
    const times = [sleepGoal, wakeGoal];
    for (const n of nights) {
      if (n.bedtime) times.push(n.bedtime);
      if (n.wakeTime) times.push(n.wakeTime);
    }
    const range = sleepAxisRange(times);
    const goal = overnightSpan(sleepGoal, wakeGoal);
    const ticks = mergeTicks(
      sleepAxisTicks(range.start, range.end),
      [goal.startMin, goal.endMin].filter(
        (t) => t >= range.start && t <= range.end
      )
    );
    return {
      ...range,
      ticks,
      goal,
    };
  }, [nights, sleepGoal, wakeGoal]);

  const bedDelta =
    selected?.bedtime != null
      ? minutesPastSleepGoal(selected.bedtime, sleepGoal)
      : null;
  const wakeDelta =
    selected?.wakeTime != null
      ? minutesPastWakeGoal(selected.wakeTime, wakeGoal)
      : null;
  const bedCopy = deltaCopy(bedDelta, "bed");
  const wakeCopy = deltaCopy(wakeDelta, "wake");
  const hoursCopy =
    selected?.hours == null
      ? { text: "Log bed and wake", tone: "muted" as const }
      : selected.metMin
        ? { text: "Hit the 7h floor", tone: "good" as const }
        : { text: "Under 7h", tone: "bad" as const };

  const plotH = compact
    ? "h-[12.5rem] sm:h-[14rem]"
    : "h-[15.5rem] sm:h-[17.5rem]";
  const goalTop = yPct(axis.goal.startMin, axis.start, axis.end);
  const goalHeight = Math.max(
    6,
    yPct(axis.goal.endMin, axis.start, axis.end) - goalTop
  );

  return (
    <div className={className}>
      {compact ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-mist)]">
            You vs should sleep
          </p>
          <Legend />
        </div>
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="ui-kicker">Schedule</p>
            <h2 className="ui-section-title mt-2 text-[1.5rem] sm:text-2xl">
              You vs should sleep
            </h2>
            <p className="ui-sub mt-2">
              Each bar is the night you took. The gold band is {sleepGoal}–
              {wakeGoal}.
            </p>
          </div>
          <Legend />
        </div>
      )}

      <div className={compact ? "mt-3" : "mt-5"}>
        <div className="flex gap-2 sm:gap-3">
          <div className={`relative w-11 shrink-0 sm:w-12 ${plotH}`}>
            {axis.ticks.map((tick) => {
              const isGoal =
                tick === axis.goal.startMin || tick === axis.goal.endMin;
              const pct = yPct(tick, axis.start, axis.end);
              const align =
                pct < 5
                  ? "translate-y-0"
                  : pct > 95
                    ? "-translate-y-full"
                    : "-translate-y-1/2";
              return (
                <span
                  key={tick}
                  className={`absolute right-0 font-mono text-[10px] tabular-nums ${align} ${
                    isGoal
                      ? "text-[var(--color-dawn)]"
                      : "text-[var(--color-mist)]"
                  }`}
                  style={{ top: `${pct}%` }}
                >
                  {minutesToHHMM(tick)}
                </span>
              );
            })}
          </div>

          <div className="relative min-w-0 flex-1">
            <div
              className={`relative overflow-hidden rounded-2xl border border-white/10 bg-black/25 ${plotH}`}
            >
              {axis.ticks.map((tick) => (
                <span
                  key={`grid-${tick}`}
                  className="pointer-events-none absolute inset-x-0 border-t border-white/[0.06]"
                  style={{ top: `${yPct(tick, axis.start, axis.end)}%` }}
                />
              ))}

              <div
                className="pointer-events-none absolute inset-x-0 border-y border-dashed border-[var(--color-dawn)]/40 bg-[var(--color-dawn)]/[0.08]"
                style={{ top: `${goalTop}%`, height: `${goalHeight}%` }}
                aria-hidden
              />

              <div className="absolute inset-0 grid grid-cols-7 gap-1 px-1.5 py-0 sm:gap-2 sm:px-3">
                {nights.map((n) => {
                  const isOn = n.date === selected?.date;
                  const late =
                    n.bedtime != null && !isSleepEarly(n.bedtime, sleepGoal);
                  return (
                    <button
                      key={n.date}
                      type="button"
                      onClick={() => setSelectedDate(n.date)}
                      className="relative h-full min-w-0"
                      aria-pressed={isOn}
                      aria-label={nightAria(n, sleepGoal)}
                    >
                      <span
                        className={`absolute inset-y-2 left-1/2 w-[42%] max-w-[1.7rem] -translate-x-1/2 rounded-full bg-white/[0.04] ${
                          isOn ? "ring-1 ring-white/35" : ""
                        }`}
                      />
                      <NightBar
                        night={n}
                        start={axis.start}
                        end={axis.end}
                        late={late}
                        selected={isOn}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
              {nights.map((n) => {
                const isOn = n.date === selected?.date;
                return (
                  <button
                    key={`${n.date}-label`}
                    type="button"
                    onClick={() => setSelectedDate(n.date)}
                    className="min-w-0 text-center"
                  >
                    <p
                      className={`text-[10px] uppercase tracking-wide ${
                        isOn ? "text-white" : "text-[var(--color-mist)]"
                      }`}
                    >
                      {n.weekday.slice(0, 2)}
                    </p>
                    <p
                      className={`font-mono text-[10px] tabular-nums ${
                        n.hours == null
                          ? "text-[var(--color-mist)]"
                          : n.metMin
                            ? "text-[var(--color-cloud)]"
                            : "text-[var(--color-ember)]"
                      }`}
                    >
                      {n.hours == null ? "—" : n.hours}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {!compact && selected ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <CompareStat
            label="In bed"
            value={selected.bedtime || "—"}
            hint={`Should ${sleepGoal}`}
            detail={bedCopy.text}
            tone={bedCopy.tone}
          />
          <CompareStat
            label="Wake"
            value={selected.wakeTime || "—"}
            hint={`Should ${wakeGoal}`}
            detail={wakeCopy.text}
            tone={wakeCopy.tone}
          />
          <CompareStat
            label="Hours"
            value={hoursLabel(selected.hours)}
            hint={`${selected.weekday} · ${prettyDate(selected.date)}`}
            detail={hoursCopy.text}
            tone={hoursCopy.tone}
          />
        </div>
      ) : null}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--color-mist)]">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-[var(--color-dawn)]" />
        You
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-[var(--color-ember)]" />
        Late
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-4 rounded-sm border border-[var(--color-dawn)]/45 bg-[var(--color-dawn)]/15" />
        Should
      </span>
    </div>
  );
}

function NightBar({
  night,
  start,
  end,
  late,
  selected,
}: {
  night: SleepTimingNight;
  start: number;
  end: number;
  late: boolean;
  selected: boolean;
}) {
  const color = late
    ? "bg-[var(--color-ember)]"
    : "bg-[var(--color-dawn)]";
  const glow = selected
    ? late
      ? "shadow-[0_0_12px_rgba(224,122,58,0.45)]"
      : "shadow-[0_0_12px_rgba(240,180,90,0.4)]"
    : "";

  if (night.bedtime && night.wakeTime) {
    const span = overnightSpan(night.bedtime, night.wakeTime);
    const top = yPct(span.startMin, start, end);
    const height = Math.max(8, yPct(span.endMin, start, end) - top);
    return (
      <span
        className={`absolute left-1/2 w-[42%] max-w-[1.7rem] -translate-x-1/2 rounded-full ${color} ${glow}`}
        style={{ top: `${top}%`, height: `${height}%` }}
      />
    );
  }

  const mark = night.bedtime || night.wakeTime;
  if (!mark) return null;
  const span = overnightSpan(
    night.bedtime || mark,
    night.wakeTime || mark
  );
  const y = yPct(night.bedtime ? span.startMin : span.endMin, start, end);
  return (
    <span
      className={`absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${color} ${glow}`}
      style={{ top: `${y}%` }}
    />
  );
}

function CompareStat({
  label,
  value,
  hint,
  detail,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  detail: string;
  tone: "good" | "bad" | "muted";
}) {
  return (
    <div className="ui-card ui-card-compact min-w-0 !text-left">
      <p className="ui-card-label">{label}</p>
      <p className="font-display mt-1 text-lg text-white sm:text-2xl">{value}</p>
      <p className="mt-1 truncate text-[11px] text-[var(--color-mist)]">{hint}</p>
      <p className={`mt-0.5 truncate text-[11px] ${toneClass(tone)}`}>{detail}</p>
    </div>
  );
}

function prettyDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function nightAria(n: SleepTimingNight, sleepGoal: string) {
  if (!n.bedtime && !n.wakeTime) return `${n.weekday}: not logged`;
  const bed = n.bedtime ? `in bed ${n.bedtime}` : "bed unknown";
  const wake = n.wakeTime ? `woke ${n.wakeTime}` : "wake unknown";
  const hours = n.hours != null ? `, ${n.hours} hours` : "";
  const late =
    n.bedtime && !isSleepEarly(n.bedtime, sleepGoal) ? ", late" : "";
  return `${n.weekday}: ${bed}, ${wake}${hours}${late}`;
}
