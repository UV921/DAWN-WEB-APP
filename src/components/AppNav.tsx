"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

const LINKS = [
  { href: "/dashboard", key: "dashboard", label: "Today", short: "Today" },
  { href: "/sleep", key: "sleep", label: "Sleep", short: "Sleep" },
  { href: "/progress", key: "progress", label: "Progress", short: "Stats" },
  { href: "/leaderboard", key: "leaderboard", label: "Board", short: "Board" },
  { href: "/circle", key: "circle", label: "Friends", short: "Friends" },
  { href: "/settings", key: "settings", label: "Settings", short: "More" },
] as const;

export type NavKey = (typeof LINKS)[number]["key"];

export function AppNav({ active }: { active: NavKey }) {
  const { data } = useSession();
  const activeIndex = Math.max(
    0,
    LINKS.findIndex((l) => l.key === active)
  );

  return (
    <>
      {/* Desktop / tablet top nav */}
      <header className="hidden items-center justify-between pb-5 md:flex">
        <div className="flex items-center gap-6 lg:gap-8">
          <Link
            href="/dashboard"
            className="font-display text-xl tracking-tight text-[var(--color-dawn)]"
          >
            Dawn
          </Link>
          <nav className="flex flex-wrap gap-4 lg:gap-5">
            {LINKS.map((l) => (
              <Link
                key={l.key}
                href={l.href}
                className={`text-sm transition duration-300 ${
                  active === l.key
                    ? "text-[var(--color-dawn)]"
                    : "text-[var(--color-mist)] hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {data?.user?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.user.image}
              alt=""
              className="h-8 w-8 rounded-full border border-white/20"
            />
          )}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm text-[var(--color-mist)] hover:text-white"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Mobile top brand bar */}
      <header className="flex items-center justify-between pb-4 md:hidden">
        <Link
          href="/dashboard"
          className="font-display text-xl tracking-tight text-[var(--color-dawn)]"
        >
          Dawn
        </Link>
        <div className="flex items-center gap-3">
          {data?.user?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.user.image}
              alt=""
              className="h-7 w-7 rounded-full border border-white/20"
            />
          )}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-xs text-[var(--color-mist)]"
          >
            Out
          </button>
        </div>
      </header>

      {/* Mobile floating dock */}
      <nav
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center md:hidden"
        style={{
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        }}
        aria-label="Primary"
      >
        <div className="floating-nav pointer-events-auto mx-3 w-full max-w-md">
          <ul
            className="relative grid grid-cols-6 gap-0.5 p-1.5"
            style={
              {
                "--nav-count": LINKS.length,
                "--nav-active": activeIndex,
              } as CSSProperties
            }
          >
            <li
              aria-hidden
              className="floating-nav-pill pointer-events-none absolute top-1.5 bottom-1.5 rounded-full"
            />
            {LINKS.map((l) => {
              const isActive = active === l.key;
              return (
                <li key={l.key} className="relative z-10">
                  <Link
                    href={l.href}
                    className={`floating-nav-link flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-full px-0.5 text-[10px] font-medium sm:text-[11px] ${
                      isActive
                        ? "is-active text-[var(--color-night)]"
                        : "text-[var(--color-mist)]"
                    }`}
                  >
                    <span
                      className={`h-1 w-1 rounded-full transition-all duration-300 ${
                        isActive
                          ? "scale-100 bg-[var(--color-night)]/70"
                          : "scale-50 bg-transparent"
                      }`}
                    />
                    <span>{l.short}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </>
  );
}
