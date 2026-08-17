"use client";

import { useState } from "react";
import { useDawnInstall } from "@/components/PwaRegister";

export function LandingInstall() {
  const { canInstall, ios, install, installed } = useDawnInstall();
  const [hint, setHint] = useState(false);

  if (installed) return null;

  return (
    <div className="landing-install">
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
      {hint ? (
        <p className="landing-install-hint">
          {ios
            ? "Share, then Add to Home Screen."
            : "Add Dawn from the browser menu."}
        </p>
      ) : (
        <p className="landing-install-copy">On your phone</p>
      )}
    </div>
  );
}
