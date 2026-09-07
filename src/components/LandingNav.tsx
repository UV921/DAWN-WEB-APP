"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChartColumnIcon } from "@/components/animated-icons/chart-column";
import { ListTodoIcon } from "@/components/animated-icons/list-todo";
import { DawnMark } from "@/components/DawnMark";
import { cn } from "@/lib/utils";

export function LandingNav({ theme, onToggleTheme }: { theme: "dark" | "light"; onToggleTheme: () => void }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const next = window.scrollY > 20;
        setScrolled((prev) => (prev === next ? prev : next));
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-2 pt-3 sm:px-5">
      <div
        className={cn(
          "mx-auto flex min-w-0 items-center transition-[max-width,border-radius,background-color,box-shadow,padding,height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          scrolled
            ? "h-12 max-w-3xl rounded-full border border-[var(--landing-border)] bg-[var(--landing-nav)] px-3 shadow-[0_12px_40px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:px-4"
            : "h-14 max-w-5xl rounded-2xl border border-transparent bg-[var(--landing-nav)] backdrop-blur-xl px-1.5 sm:px-4"
        )}
      >
        <a href="#top" className="shrink-0 text-[var(--landing-accent)]" aria-label="Dawn">
          <DawnMark size={scrolled ? 20 : 24} />
        </a>
        <nav className="ml-auto flex min-w-0 items-center gap-0 ">
          <a
            href="#new"
            className="hidden rounded-full px-2 py-3 text-[12px] text-[var(--landing-muted)] transition hover:bg-white/5 hover:text-[var(--landing-text)] sm:inline-flex sm:px-2.5"
          >
            New
          </a>
          <a
            href="#tasks"
            aria-label="Tasks"
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-3 text-[12px] text-[var(--landing-muted)] transition hover:bg-white/5 hover:text-[var(--landing-text)] sm:px-2.5"
          >
            <ListTodoIcon size={16} />
            <span className="hidden sm:inline">Tasks</span>
          </a>
          <a
            href="#study"
            className="rounded-full px-2 py-3 text-[12px] text-[var(--landing-muted)] transition hover:bg-white/5 hover:text-[var(--landing-text)] sm:px-2.5"
          >
            Study
          </a>
          <a
            href="#clock"
            className="hidden rounded-full px-2 py-3 text-[12px] text-[var(--landing-muted)] transition hover:bg-white/5 hover:text-[var(--landing-text)] sm:inline sm:px-2.5"
          >
            Day
          </a>
          <a
            href="#stats"
            aria-label="Stats"
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-3 text-[12px] text-[var(--landing-muted)] transition hover:bg-white/5 hover:text-[var(--landing-text)] sm:px-2.5"
          >
            <ChartColumnIcon size={16} />
            <span className="hidden sm:inline">Stats</span>
          </a>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--landing-accent)] hover:bg-[var(--landing-inset)] focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              {theme === "dark" ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></> : <path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" />}
            </svg>
          </button>
          <Link
            href="/login"
            className="dawn-btn dawn-btn-nav ml-1 shrink-0"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
