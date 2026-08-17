"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

const PEOPLE = [
  { name: "you", live: true, hue: "#f0b45a" },
  { name: "ira", live: true, hue: "#6fbf8a" },
  { name: "leo", live: true, hue: "#8ba3b8" },
  { name: "sam", live: false, hue: "#5865F2" },
];

export function LandingStudyFilm() {
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { margin: "-80px" });
  const still = Boolean(reduce) || !inView;
  const [secs, setSecs] = useState(reduce ? 6120 : 5980);

  useEffect(() => {
    if (still) return;
    const id = window.setInterval(() => setSecs((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [still]);

  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const clock = `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;

  return (
    <div
      ref={root}
      className={cn(
        "relative flex h-full min-h-[22rem] min-w-0 flex-col overflow-hidden bg-[#0b0f16]",
        still && "study-film-still"
      )}
      aria-label="Sit in a marked Discord study room. Dawn counts the hours."
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(88,101,242,0.22),transparent_50%),radial-gradient(ellipse_at_80%_20%,rgba(240,180,90,0.16),transparent_45%)]"
      />

      <div className="relative flex min-w-0 items-center gap-3 border-b border-white/[0.08] px-4 py-3 sm:px-5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5865F2] text-white">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M11 5 6 9H3v6h3l5 4V5Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="M16 9.5a4 4 0 0 1 0 5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8ba9ff]">
            Voice
          </p>
          <p className="truncate text-[14px] text-white">Study</p>
        </div>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#6fbf8a]/15 px-2.5 py-1 text-[11px] font-medium text-[#6fbf8a]">
          <span className="study-live-dot" />
          Live
        </span>
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col justify-center gap-5 px-4 py-5 sm:px-5">
        <div className="min-w-0 text-center">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#f0b45a]">
            Today
          </p>
          <p className="font-display mt-2 break-words text-[clamp(1.35rem,5.2vw,2rem)] leading-none tabular-nums tracking-tight text-white">
            {clock}
          </p>
          <div className="study-wave mx-auto mt-4">
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
          <p className="mt-3 text-[12px] text-[#8ba3b8]">
            Marked VC · counting
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
          {PEOPLE.map((p, i) => (
            <motion.div
              key={p.name}
              className="flex min-w-0 items-center gap-2 steel-plate-sm rounded-xl bg-white/[0.03] px-2.5 py-2.5 sm:gap-3 sm:px-3 sm:py-3"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i, duration: 0.45, ease: EASE }}
            >
              <span className="relative shrink-0">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-[#0a0e12] sm:h-10 sm:w-10 sm:text-[12px]"
                  style={{ background: p.hue }}
                >
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                {p.live ? <span className="study-ring" /> : null}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] text-white">{p.name}</p>
                <p className="truncate text-[11px] text-[#8ba3b8]">
                  {p.live ? "in room" : "idle"}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
