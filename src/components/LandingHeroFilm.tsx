"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const BEATS = [
  { label: "Wake", rest: "05:52", done: true },
  { label: "Lists", rest: "2 of 4", done: false },
  { label: "Study", rest: "live", live: true },
  { label: "Night", rest: "23:00", done: false },
];

function clock(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

export function LandingHeroFilm() {
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { margin: "-40px" });
  const still = Boolean(reduce) || !inView;
  const [secs, setSecs] = useState(reduce ? 6138 : 6132);
  const [now, setNow] = useState(2);

  useEffect(() => {
    if (still) return;
    const tick = window.setInterval(() => setSecs((n) => n + 1), 1000);
    const beat = window.setInterval(() => {
      setNow((n) => (n + 1) % BEATS.length);
    }, 2800);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(beat);
    };
  }, [still]);

  return (
    <div
      ref={root}
      className={cn(
        "flex h-full min-w-0 flex-col bg-[#0a0e12]",
        still && "study-film-still"
      )}
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-[#f0b45a]">
          Today
        </p>
        <p className="font-mono text-[11px] text-[#8ba3b8]">the loop</p>
      </div>
      <ul className="flex-1">
        {BEATS.map((beat, i) => {
          const on = still ? i === 0 : now === i;
          const study = Boolean(beat.live);
          return (
            <li
              key={beat.label}
              className={cn(
                "flex min-w-0 items-center gap-4 border-t border-white/[0.07] px-5 py-5 md:py-7",
                on && "bg-white/[0.04]"
              )}
            >
              <span
                className={cn(
                  "font-mono w-4 shrink-0 text-[12px]",
                  on ? "text-[#f0b45a]" : "text-[#6b7785]"
                )}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-[16px] text-white md:text-[18px]">
                {beat.label}
              </span>
              {study ? (
                <span className="flex shrink-0 items-center gap-2 font-mono text-[12px] tabular-nums text-[#6fbf8a] md:text-[13px]">
                  <span className="study-live-dot" />
                  {clock(secs)}
                </span>
              ) : (
                <span
                  className={cn(
                    "font-mono shrink-0 text-[12px] md:text-[13px]",
                    beat.done ? "text-[#f0b45a]" : "text-[#8ba3b8]"
                  )}
                >
                  {beat.rest}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
