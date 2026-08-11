"use client";

import { useEffect, useState } from "react";
import { enableMotionSensing } from "@/components/AppPresenceTracker";

/**
 * Quiet “did you open Dawn?” strip — classic, minimal.
 */
export function MorningShowUpCard() {
  const [first, setFirst] = useState<string | null>(null);
  const [wakeGoal, setWakeGoal] = useState("06:00");
  const [openStreak, setOpenStreak] = useState(0);
  const [motion, setMotion] = useState(false);

  useEffect(() => {
    void fetch("/api/opens")
      .then((r) => r.json())
      .then((data) => {
        setFirst(data.firstOpenTimeToday || null);
        if (data.wakeGoal) setWakeGoal(data.wakeGoal);
        if (typeof data.openStreak === "number") setOpenStreak(data.openStreak);
      })
      .catch(() => undefined);
    setMotion(sessionStorage.getItem("dawn-motion") === "1");
  }, []);

  const onTime = first && wakeGoal ? first <= wakeGoal : null;

  return (
    <section className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
      <div>
        <p className="text-sm text-white">
          {first ? (
            <>
              Opened at{" "}
              <span className="font-display text-lg text-[var(--color-dawn)]">
                {first}
              </span>
              {onTime === true ? (
                <span className="text-[var(--color-mist)]"> · on time</span>
              ) : onTime === false ? (
                <span className="text-[var(--color-mist)]"> · after {wakeGoal}</span>
              ) : null}
            </>
          ) : (
            <span className="text-[var(--color-mist)]">
              Not opened yet · goal {wakeGoal}
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-4 text-sm text-[var(--color-mist)]">
        <span>
          <span className="ui-stat text-base">{openStreak}</span> day
          {openStreak === 1 ? "" : "s"} streak
        </span>
        {!motion ? (
          <button
            type="button"
            className="ui-btn-text text-xs"
            onClick={() => void enableMotionSensing().then((ok) => setMotion(ok))}
          >
            Phone pickup
          </button>
        ) : null}
      </div>
    </section>
  );
}
