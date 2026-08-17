"use client";

import { useEffect, useState } from "react";
import { enableMotionSensing } from "@/components/AppPresenceTracker";

type OpenRow = {
  id: string;
  time: string;
  source: string;
  standalone: boolean;
};

const SOURCE_LABEL: Record<string, string> = {
  cold: "App launch",
  visibility: "Came back",
  focus: "Window focus",
  resume: "Resumed",
  motion: "Phone lift",
};

export function OpenTrackerCard() {
  const [first, setFirst] = useState<string | null>(null);
  const [opens, setOpens] = useState<OpenRow[]>([]);
  const [wakeGoal, setWakeGoal] = useState("06:00");
  const [motion, setMotion] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch("/api/opens");
    if (!res.ok) return;
    const data = await res.json();
    setFirst(data.firstOpenTimeToday || null);
    setOpens(data.opens || []);
    if (data.wakeGoal) setWakeGoal(data.wakeGoal);
  }

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 45_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    setMotion(sessionStorage.getItem("dawn-motion") === "1");
  }, []);

  async function enableMotion() {
    const ok = await enableMotionSensing();
    setMotion(ok);
    setMsg(
      ok
        ? "Motion on — morning phone lifts count as opens."
        : "Motion permission denied. Visibility tracking still works."
    );
  }

  const vsWake =
    first && wakeGoal
      ? first <= wakeGoal
        ? "Opened before / at wake goal"
        : "Opened after wake goal"
      : null;

  return (
    <section className="steel-plate rounded-2xl bg-white/[0.03] px-4 py-4 sm:px-5">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-dawn)]">
        Open sensing
      </p>
      <p className="font-display mt-1 text-xl text-white sm:text-2xl">
        {first ? `First open today · ${first}` : "Not opened yet today"}
      </p>
      {vsWake ? (
        <p
          className={`mt-1 text-sm ${
            first && first <= wakeGoal
              ? "text-[var(--color-leaf)]"
              : "text-[var(--color-ember)]"
          }`}
        >
          {vsWake} (goal {wakeGoal})
        </p>
      ) : (
        <p className="mt-1 text-sm text-[var(--color-mist)]">
          Tracks when you open Dawn — visibility, resume, optional phone motion.
        </p>
      )}

      {opens.length > 0 ? (
        <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto text-xs text-[var(--color-mist)]">
          {opens
            .slice()
            .reverse()
            .slice(0, 8)
            .map((o) => (
              <li key={o.id} className="flex justify-between gap-2">
                <span>{SOURCE_LABEL[o.source] || o.source}</span>
                <span className="font-mono text-white/80">
                  {o.time}
                  {o.standalone ? " · app" : ""}
                </span>
              </li>
            ))}
        </ul>
      ) : null}

      {!motion ? (
        <button
          type="button"
          onClick={() => void enableMotion()}
          className="mt-3 w-full rounded-full border border-white/20 px-4 py-2.5 text-sm text-white sm:w-auto"
        >
          Enable phone-lift sensor
        </button>
      ) : (
        <p className="mt-3 text-xs text-[var(--color-leaf)]">
          Motion sensing on (mornings)
        </p>
      )}
      {msg ? <p className="mt-2 text-xs text-[var(--color-mist)]">{msg}</p> : null}
    </section>
  );
}
