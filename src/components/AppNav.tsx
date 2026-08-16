"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { DawnSquare } from "@/components/DawnMark";
import { IconChevronDown } from "@/components/icons";
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
  size = 22,
}: {
  Icon: (typeof DESKTOP)[number]["Icon"];
  active: boolean;
  size?: number;
}) {
  const ref = useRef<AnimatedIconHandle>(null);

  useEffect(() => {
    if (active) ref.current?.startAnimation();
  }, [active]);

  return (
    <Icon
      ref={ref}
      size={size}
      className="floating-nav-icon pointer-events-none"
    />
  );
}

function AccountMenu() {
  const { data } = useSession();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const name =
    data?.user?.name?.split(" ")[0] ||
    data?.user?.email?.split("@")[0] ||
    "Account";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full py-1 pl-0.5 pr-1.5 text-[13px] text-[#c5ced6] transition hover:text-white"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {data?.user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.user.image}
            alt=""
            className="h-7 w-7 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[11px] font-medium text-white">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="hidden max-w-[9rem] truncate lg:inline">{name}</span>
        <IconChevronDown
          size={14}
          className={`shrink-0 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 min-w-[10rem] rounded-xl border border-white/10 bg-[#10161c] py-1 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full px-3 py-2 text-left text-[13px] text-[#c5ced6] hover:bg-white/5 hover:text-white"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
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
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 hidden border-b border-white/[0.07] bg-[#0a1016]/88 backdrop-blur-xl md:block">
        <div className="pointer-events-auto mx-auto flex h-14 max-w-6xl items-center gap-4 px-5">
          <Link
            href="/dashboard"
            className="shrink-0"
            aria-label="Dawn"
          >
            <DawnSquare size={28} />
          </Link>
          <nav
            className="flex min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:gap-1"
            aria-label="Primary"
          >
            {DESKTOP.map((l) => {
              const isActive = active === l.key;
              return (
                <Link
                  key={l.key}
                  href={l.href}
                  prefetch
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] transition lg:px-3 ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-[#9aa8b5] hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <NavGlyph Icon={l.Icon} active={isActive} size={16} />
                  <span className="hidden sm:inline">{l.label}</span>
                </Link>
              );
            })}
          </nav>
          <AccountMenu />
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
