"use client";

import { useState } from "react";
import { useDawnInstall } from "@/components/PwaRegister";
import { cn } from "@/lib/utils";

export function LandingInstall({
  variant = "landing",
}: {
  variant?: "landing" | "app";
}) {
  const { canInstall, ios, install, installed, dismissed, dismiss } =
    useDawnInstall();
  const [hint, setHint] = useState(false);

  if (installed || dismissed) return null;

  return (
    <div
      className={cn(
        "landing-install",
        variant === "app" && "landing-install-app"
      )}
    >
      <p className="landing-install-copy">
        {hint
          ? ios
            ? "Share, then Add to Home Screen."
            : "Add Dawn from the browser menu."
          : variant === "app"
            ? "Install Dawn"
            : "On your phone"}
      </p>
      <button
        type="button"
        className="landing-install-skip"
        onClick={dismiss}
        aria-label="Skip install"
      >
        Skip
      </button>
      <button
        type="button"
        className="landing-install-btn"
        onClick={() => {
          if (canInstall) {
            void install();
            return;
          }
          setHint((v) => !v);
        }}
      >
        Install
      </button>
    </div>
  );
}
