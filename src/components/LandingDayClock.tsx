"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";

const EASE = [0.22, 1, 0.36, 1] as const;
const STEP_MS = 3200;

const STEPS = [
  {
    id: "wake",
    label: "Wake",
    why: "I’m awake only counts in the window.",
    x: 25,
    y: 22,
  },
  {
    id: "lists",
    label: "Lists",
    why: "Buy, Share on X, Today — check them off.",
    x: 44,
    y: 38,
  },
  {
    id: "study",
    label: "Study",
    why: "Sit in the marked VC. Hours count.",
    x: 66,
    y: 18,
  },
  {
    id: "night",
    label: "Night",
    why: "Set tomorrow. Then Dawn says sleep.",
    x: 92,
    y: 62,
  },
] as const;

const W = 640;
const H = 248;
const PAD = { l: 8, r: 8, t: 36, b: 40 };

function px(x: number, y: number) {
  const gw = W - PAD.l - PAD.r;
  const gh = H - PAD.t - PAD.b;
  return {
    x: PAD.l + (x / 100) * gw,
    y: PAD.t + (y / 100) * gh,
  };
}

const LINE = [
  { x: 0, y: 78 },
  { x: 12, y: 74 },
  STEPS[0],
  { x: 34, y: 30 },
  STEPS[1],
  { x: 54, y: 42 },
  STEPS[2],
  { x: 78, y: 36 },
  STEPS[3],
  { x: 100, y: 82 },
].map((p) => px(p.x, p.y));

const D = LINE.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
const AREA = `${D} L ${px(100, 100).x} ${px(100, 100).y} L ${px(0, 100).x} ${px(0, 100).y} Z`;

type Props = {
  wakeStart: string;
  wakeEnd: string;
  sleepStart: string;
  sleepEnd: string;
};

export function LandingDayClock({ wakeStart, sleepStart }: Props) {
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { margin: "-80px" });
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const dot = px(current.x, current.y);
  const times = [wakeStart, "day", "VC", sleepStart];

  useEffect(() => {
    if (reduce || !inView) return;
    const id = window.setInterval(() => {
      setStep((n) => (n + 1) % STEPS.length);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [reduce, inView]);

  return (
    <div ref={root}>
      <AnimatePresence mode="wait">
        <motion.p
          key={current.id}
          className="font-display min-h-[2.6rem] text-[1.35rem] leading-snug text-white sm:text-[1.55rem]"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.35 }}
        >
          {current.why}
        </motion.p>
      </AnimatePresence>

      <div className="mt-6">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          aria-label="Dawn’s day: wake, lists, study, night"
        >
          <defs>
            <linearGradient id="dawn-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f0b45a" stopOpacity="0.26" />
              <stop offset="100%" stopColor="#f0b45a" stopOpacity="0" />
            </linearGradient>
          </defs>

          <text
            x={PAD.l}
            y="16"
            fill="#6b7785"
            fontSize="10"
            letterSpacing="0.16em"
            fontFamily="ui-monospace, monospace"
          >
            SHOWING UP
          </text>

          <motion.path
            d={AREA}
            fill="url(#dawn-area)"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          />
          <motion.path
            d={D}
            fill="none"
            stroke="#f0b45a"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.3, ease: EASE }}
          />

          {STEPS.map((s, i) => {
            const p = px(s.x, s.y);
            const on = i === step;
            return (
              <g key={s.id}>
                <text
                  x={p.x}
                  y={p.y - 14}
                  textAnchor="middle"
                  fill={on ? "#f0b45a" : "#8ba3b8"}
                  fontSize="11"
                  fontFamily="var(--font-display), Georgia, serif"
                >
                  {s.label}
                </text>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={on ? 5 : 3}
                  fill={on ? "#f0b45a" : "#0a0e12"}
                  stroke="#f0b45a"
                  strokeWidth="1.6"
                />
              </g>
            );
          })}

          <motion.g
            initial={{
              x: px(STEPS[0].x, STEPS[0].y).x,
              y: px(STEPS[0].x, STEPS[0].y).y,
            }}
            animate={{ x: dot.x, y: dot.y }}
            transition={{ duration: reduce ? 0 : 0.7, ease: EASE }}
          >
            <circle r="12" fill="rgba(240,180,90,0.16)" />
            <circle r="4.5" fill="#f0b45a" />
          </motion.g>

          <line
            x1={PAD.l}
            y1={H - PAD.b}
            x2={W - PAD.r}
            y2={H - PAD.b}
            stroke="rgba(255,255,255,0.14)"
          />
          <text
            x={PAD.l}
            y={H - 14}
            fill="#6b7785"
            fontSize="11"
            fontFamily="ui-monospace, monospace"
          >
            00
          </text>
          <text
            x={W / 2}
            y={H - 14}
            textAnchor="middle"
            fill="#6b7785"
            fontSize="11"
            fontFamily="ui-monospace, monospace"
          >
            12
          </text>
          <text
            x={W - PAD.r}
            y={H - 14}
            textAnchor="end"
            fill="#6b7785"
            fontSize="11"
            fontFamily="ui-monospace, monospace"
          >
            24
          </text>
        </svg>
      </div>

      <div className="mt-5 flex gap-1">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(i)}
            className={`flex-1 rounded-xl px-2 py-2 text-center text-[12px] transition ${
              i === step
                ? "bg-[#f0b45a] font-medium text-[#0a0e12]"
                : "bg-white/[0.04] text-[#8ba3b8] hover:text-white"
            }`}
          >
            {s.label}
            <span className="mt-0.5 block font-mono text-[10px] opacity-70">
              {times[i]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
