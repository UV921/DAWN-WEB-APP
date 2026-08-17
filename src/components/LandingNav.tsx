"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChartColumnIcon } from "@/components/animated-icons/chart-column";
import { ListTodoIcon } from "@/components/animated-icons/list-todo";
import { DawnMark } from "@/components/DawnMark";
import { cn } from "@/lib/utils";

export function LandingNav() {
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
            ? "h-12 max-w-3xl rounded-full border border-white/12 bg-[#0a0e12]/80 px-3 shadow-[0_12px_40px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:px-4"
            : "h-14 max-w-5xl rounded-2xl border border-transparent bg-transparent px-1.5 sm:px-4"
        )}
      >
        <a href="#top" className="shrink-0 text-[#f0b45a]" aria-label="Dawn">
          <DawnMark size={scrolled ? 20 : 24} />
        </a>
        <nav className="ml-auto flex min-w-0 items-center gap-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <a
            href="#tasks"
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[12px] text-[#c5ced6] transition hover:bg-white/5 hover:text-white sm:px-2.5"
          >
            <ListTodoIcon size={16} />
            <span className="hidden sm:inline">Tasks</span>
          </a>
          <a
            href="#study"
            className="rounded-full px-2 py-1.5 text-[12px] text-[#c5ced6] transition hover:bg-white/5 hover:text-white sm:px-2.5"
          >
            Study
          </a>
          <a
            href="#clock"
            className="hidden rounded-full px-2 py-1.5 text-[12px] text-[#c5ced6] transition hover:bg-white/5 hover:text-white sm:inline sm:px-2.5"
          >
            Day
          </a>
          <a
            href="#stats"
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[12px] text-[#c5ced6] transition hover:bg-white/5 hover:text-white sm:px-2.5"
          >
            <ChartColumnIcon size={16} />
            <span className="hidden sm:inline">Stats</span>
          </a>
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
