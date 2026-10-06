"use client";

import { APP_CHANNEL, APP_VERSION } from "@/lib/app-version";
import { cn } from "@/lib/utils";

export function VersionBadge({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-[var(--lp-gold)]/40 bg-[var(--lp-gold)]/12 font-mono font-medium tracking-[0.14em] text-[var(--lp-gold)] uppercase",
        size === "sm"
          ? "px-2 py-0.5 text-[9px]"
          : "px-2.5 py-1 text-[10px]",
        className
      )}
      title={`Dawn ${APP_CHANNEL} v${APP_VERSION}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--lp-gold)]" />
      {APP_CHANNEL}
      <span className="opacity-70">v{APP_VERSION}</span>
    </span>
  );
}
