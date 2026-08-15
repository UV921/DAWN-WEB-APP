"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { SunIcon } from "@/components/animated-icons/sun";
import { MoonIcon } from "@/components/animated-icons/moon";
import { ChartColumnIcon } from "@/components/animated-icons/chart-column";
import { FlameIcon } from "@/components/animated-icons/flame";
import { UsersIcon } from "@/components/animated-icons/users";
import { SettingsIcon } from "@/components/animated-icons/settings";
import { ListTodoIcon } from "@/components/animated-icons/list-todo";
import type { AnimatedIconHandle } from "@/components/animated-icons/use-icon-animation";

const DESKTOP = [
  { href: "/dashboard", key: "dashboard", label: "Today", Icon: SunIcon },
  { href: "/tasks", key: "tasks", label: "Tasks", Icon: ListTodoIcon },
  { href: "/sleep", key: "sleep", label: "Sleep", Icon: MoonIcon },
  { href: "/progress", key: "progress", label: "Progress", Icon: ChartColumnIcon },
  { href: "/leaderboard", key: "leaderboard", label: "Board", Icon: FlameIcon },
  { href: "/circle", key: "circle", label: "Friends", Icon: UsersIcon },
  { href: "/settings", key: "settings", label: "Settings", Icon: SettingsIcon },
] as const;

const MOBILE = [
  { href: "/dashboard", key: "dashboard", label: "Today", Icon: SunIcon },
  { href: "/tasks", key: "tasks", label: "Tasks", Icon: ListTodoIcon },
  { href: "/sleep", key: "sleep", label: "Night", Icon: MoonIcon },
  { href: "/progress", key: "progress", label: "Stats", Icon: ChartColumnIcon },
  { href: "/settings", key: "settings", label: "More", Icon: SettingsIcon },
] as const;

export type NavKey = (typeof DESKTOP)[number]["key"];

function NavGlyph({
  Icon,
  active,
}: {
  Icon: (typeof MOBILE)[number]["Icon"];
  active: boolean;
}) {
  const ref = useRef<AnimatedIconHandle>(null);

  useEffect(() => {
    if (active) ref.current?.startAnimation();
  }, [active]);

  return (
    <Icon
      ref={ref}
      size={22}
      className="floating-nav-icon pointer-events-none"
    />
  );
}

export function AppNav({ active }: { active: NavKey }) {
  const { data } = useSession();
  const mapped: NavKey =
    active === "leaderboard" || active === "circle" ? "settings" : active;
  const mobileIndex = Math.max(
    0,
    MOBILE.findIndex((l) => l.key === mapped)
  );

  return (
    <>
      <header className="relative left-1/2 hidden w-screen max-w-[100vw] -translate-x-1/2 pb-5 md:block">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6">
          <Link
            href="/dashboard"
            className="font-display shrink-0 text-xl tracking-tight text-[var(--color-dawn)]"
          >
            Dawn
          </Link>
          <nav className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto whitespace-nowrap [scrollbar-width:none] lg:gap-5 [&::-webkit-scrollbar]:hidden">
            {DESKTOP.map((l) => (
              <Link
                key={l.key}
                href={l.href}
                prefetch
                className={`shrink-0 text-[13px] transition lg:text-sm ${
                  active === l.key
                    ? "text-[var(--color-dawn)]"
                    : "text-[var(--color-mist)] hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-3">
            {data?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.user.image}
                alt=""
                className="h-8 w-8 rounded-full border border-white/20"
              />
            ) : null}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-[13px] text-[var(--color-mist)] hover:text-white lg:text-sm"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <header className="flex items-center justify-between pb-3 md:hidden">
        <Link
          href="/dashboard"
          className="font-display text-xl tracking-tight text-[var(--color-dawn)]"
        >
          Dawn
        </Link>
        {data?.user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.user.image}
            alt=""
            className="h-7 w-7 rounded-full border border-white/20"
          />
        ) : (
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-xs text-[var(--color-mist)]"
          >
            Sign out
          </button>
        )}
      </header>

      <nav
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center md:hidden"
        style={{
          paddingBottom: "max(0.65rem, env(safe-area-inset-bottom))",
        }}
        aria-label="Primary"
      >
        <div className="floating-nav pointer-events-auto mx-3 w-full max-w-md">
          <ul
            className="relative grid grid-cols-5 p-1"
            style={
              {
                "--nav-count": MOBILE.length,
                "--nav-active": mobileIndex,
              } as CSSProperties
            }
          >
            <li
              aria-hidden
              className="floating-nav-pill pointer-events-none absolute top-1 bottom-1 rounded-[1.15rem]"
            />
            {MOBILE.map((l) => {
              const isActive = mapped === l.key;
              return (
                <li key={l.key} className="relative z-10">
                  <Link
                    href={l.href}
                    prefetch
                    className={`floating-nav-link flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-[1.1rem] px-0.5 text-[10px] font-medium ${
                      isActive
                        ? "is-active text-[var(--color-night)]"
                        : "text-[var(--color-mist)]"
                    }`}
                  >
                    <NavGlyph Icon={l.Icon} active={isActive} />
                    <span className="leading-none">{l.label}</span>
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
