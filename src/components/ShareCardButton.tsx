"use client";

import { useState } from "react";
import { IconShare } from "@/components/icons";

type Result = "shared" | "downloaded";

export function ShareCardButton({
  label = "Share",
  make,
  disabled,
  className = "",
}: {
  label?: string;
  make: () => Promise<Result>;
  disabled?: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function onClick() {
    if (busy || disabled) return;
    setBusy(true);
    setNote("");
    try {
      const result = await make();
      setNote(
        result === "shared"
          ? "Opened share — pick X, WhatsApp, or Photos."
          : "Saved a PNG — attach it on X or send it."
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setNote("Couldn’t make the card. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={busy || disabled}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-dawn)]/35 bg-[var(--color-dawn)]/10 px-3 py-1.5 text-xs font-medium text-[var(--color-dawn)] disabled:opacity-50"
      >
        <IconShare size={13} />
        {busy ? "Making…" : label}
      </button>
      {note ? (
        <p className="mt-1.5 text-[11px] text-[var(--color-mist)]">{note}</p>
      ) : null}
    </div>
  );
}
