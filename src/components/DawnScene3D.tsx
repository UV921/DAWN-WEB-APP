"use client";

import { cn } from "@/lib/utils";

export type DawnSceneTone = "hero" | "google" | "code" | "board" | "study";

export function DawnScene3D({
  tone = "hero",
  still = false,
  className,
}: {
  tone?: DawnSceneTone;
  still?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("dawn-scene", `is-${tone}`, still && "is-still", className)}
      aria-hidden
    >
      <div className="dawn-scene-stage">
        {tone === "hero" ? null : <div className="dawn-scene-sky" />}
        <div className="dawn-scene-glow" />
        <div className="dawn-scene-sun" />
        {tone === "google" ? <WaterPlanes /> : null}
        {tone === "code" ? <PairPlanes /> : null}
        {tone === "board" ? <PeakPlanes /> : null}
        {tone === "study" ? <LampPlanes /> : null}
        {tone === "hero" ? null : (
          <>
            <div className="dawn-scene-ridge" />
            <div className="dawn-scene-horizon" />
          </>
        )}
      </div>
      <div className="dawn-scene-grain" />
    </div>
  );
}

function WaterPlanes() {
  return (
    <div className="dawn-scene-water">
      <span />
      <span />
      <span />
    </div>
  );
}

function PairPlanes() {
  return (
    <div className="dawn-scene-pair">
      <span />
      <span />
    </div>
  );
}

function PeakPlanes() {
  return (
    <div className="dawn-scene-peaks">
      <span />
      <span />
      <span />
    </div>
  );
}

function LampPlanes() {
  return (
    <div className="dawn-scene-aisle">
      <span />
      <span />
      <span />
      <span />
      <i />
      <i />
      <i />
    </div>
  );
}
