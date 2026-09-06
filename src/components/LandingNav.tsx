"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChartColumnIcon } from "@/components/animated-icons/chart-column";
import { ListTodoIcon } from "@/components/animated-icons/list-todo";
import { MoonIcon } from "@/components/animated-icons/moon";
import { SunIcon } from "@/components/animated-icons/sun";
import { DawnMark } from "@/components/DawnMark";
import { useLandingTheme } from "@/components/LandingTheme";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#new", label: "New" },
  { href: "#tasks", label: "Tasks", icon: "tasks" as const },
  { href: "#study", label: "Study" },
  { href: "#clock", label: "Day", hideMobile: true },
  { href: "#stats", label: "Stats", icon: "stats" as const },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useLandingTheme();

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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-2 pt-3 sm:px-5">
      <div
        className={cn(
          "mx-auto flex min-w-0 items-center transition-[max-width,border-radius,background-color,box-shadow,padding,height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          scrolled
            ? "h-12 max-w-3xl rounded-full border border-[var(--lp-border)] bg-[var(--lp-bg)]/80 px-3 shadow-[0_12px_40px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:px-4"
            : "h-14 max-w-5xl rounded-2xl border border-transparent bg-transparent px-1.5 sm:px-4"
        )}
      >
        <a
          href="#top"
          className="shrink-0 text-[var(--lp-gold)]"
          aria-label="Dawn"
        >
          <DawnMark size={scrolled ? 20 : 24} />
        </a>
        <nav className="ml-auto hidden min-w-0 items-center gap-0 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] text-[var(--lp-dim)] transition hover:bg-[var(--lp-inset)] hover:text-[var(--lp-fg)]",
                l.hideMobile && "lg:inline-flex"
              )}
            >
              {l.icon === "tasks" ? <ListTodoIcon size={16} /> : null}
              {l.icon === "stats" ? <ChartColumnIcon size={16} /> : null}
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-1">
          <button
            type="button"
            onClick={toggle}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--lp-dim)] transition hover:bg-[var(--lp-inset)] hover:text-[var(--lp-fg)]"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}
          </button>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--lp-dim)] transition hover:bg-[var(--lp-inset)] hover:text-[var(--lp-fg)] md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">{open ? "Close" : "Menu"}</span>
            <span className="flex w-4 flex-col gap-1" aria-hidden>
              <span
                className={cn(
                  "block h-0.5 rounded-full bg-current transition",
                  open && "translate-y-1.5 rotate-45"
                )}
              />
              <span
                className={cn(
                  "block h-0.5 rounded-full bg-current transition",
                  open && "opacity-0"
                )}
              />
              <span
                className={cn(
                  "block h-0.5 rounded-full bg-current transition",
                  open && "-translate-y-1.5 -rotate-45"
                )}
              />
            </span>
          </button>
          <Link href="/login" className="dawn-btn dawn-btn-nav shrink-0">
            Sign in
          </Link>
        </div>
      </div>
      {open ? (
        <div className="mx-auto mt-2 max-w-5xl rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-card)]/95 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl md:hidden">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-[var(--lp-fg)] hover:bg-[var(--lp-inset)]"
            >
              {l.icon === "tasks" ? <ListTodoIcon size={16} /> : null}
              {l.icon === "stats" ? <ChartColumnIcon size={16} /> : null}
              {l.label}
            </a>
          ))}
        </div>
      ) : null}
    </header>
  );
}
