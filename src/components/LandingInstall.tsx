"use client";

import { useState } from "react";
import { useDawnInstall } from "@/components/PwaRegister";

export function LandingInstall() {
  const { canInstall, ios, install } = useDawnInstall();
  const [hint, setHint] = useState(false);

  if (!canInstall && !ios) return null;

  return (
    <div className="landing-install">
      <button
        type="button"
        className="landing-install-btn"
        onClick={() => {
          if (ios) {
            setHint((v) => !v);
            return;
          }
          void install();
        }}
      >
        Install
      </button>
      {hint ? (
        <p className="landing-install-hint">Share, then Add to Home Screen.</p>
      ) : null}
    </div>
  );
}
