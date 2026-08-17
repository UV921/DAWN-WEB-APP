"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { DawnSquare } from "@/components/DawnMark";
import { IconMoreVertical, IconPanelClose, IconPanelOpen } from "@/components/icons";
import { SunIcon } from "@/components/animated-icons/sun";
import { MoonIcon } from "@/components/animated-icons/moon";
import { ChartColumnIcon } from "@/components/animated-icons/chart-column";
import { FlameIcon } from "@/components/animated-icons/flame";
import { UsersIcon } from "@/components/animated-icons/users";
import { SettingsIcon } from "@/components/animated-icons/settings";
import { ListTodoIcon } from "@/components/animated-icons/list-todo";
import type { AnimatedIconHandle } from "@/components/animated-icons/use-icon-animation";

const PRIMARY = [
  { href: "/dashboard", key: "dashboard", label: "Today", Icon: SunIcon },
  { href: "/tasks", key: "tasks", label: "Tasks", Icon: ListTodoIcon },
  { href: "/sleep", key: "sleep", label: "Sleep", Icon: MoonIcon },
  { href: "/progress", key: "progress", label: "Progress", Icon: ChartColumnIcon },
  { href: "/leaderboard", key: "leaderboard", label: "Board", Icon: FlameIcon },
  { href: "/circle", key: "circle", label: "Friends", Icon: UsersIcon },
] as const;

const DESKTOP = [
  ...PRIMARY,
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

function SidebarAccount() {
  const { data } = useSession();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const name = data?.user?.name || data?.user?.email?.split("@")[0] || "Account";
  const handle =
    data?.user?.email?.split("@")[0] ||
    name.toLowerCase().replace(/\s+/g, "-");

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-2xl px-2 py-2 text-left transition hover:bg-white/[0.05]"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {data?.user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.user.image}
            alt=""
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-medium text-white">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-white">
            {name}
          </span>
          <span className="block truncate text-[11px] text-[#8ba3b8]">
            #{handle}
          </span>
        </span>
        <IconMoreVertical size={16} className="shrink-0 text-[#8ba3b8]" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute bottom-full left-0 right-0 z-50 mb-2 steel-plate-sm rounded-xl bg-[#10161c] py-1 shadow-xl"
        >
          <Link
            href="/settings"
            role="menuitem"
            className="flex w-full px-3 py-2 text-left text-[13px] text-[#c5ced6] hover:bg-white/5 hover:text-white"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
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

const SIDEBAR_KEY = "dawn-sidebar-open";

export function AppNav({ active }: { active: NavKey }) {
  const { data } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const mapped: NavKey =
    active === "leaderboard" || active === "circle" ? "settings" : active;
  const mobileIndex = Math.max(
    0,
    MOBILE.findIndex((l) => l.key === mapped)
  );

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored === "0") setSidebarOpen(false);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("sidebar-collapsed", !sidebarOpen);
    return () => document.documentElement.classList.remove("sidebar-collapsed");
  }, [sidebarOpen]);

  function toggleSidebar() {
    setSidebarOpen((open) => {
      const next = !open;
      localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <>
      {!sidebarOpen ? (
        <button
          type="button"
          onClick={toggleSidebar}
          className="sidebar-toggle is-dock"
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          <IconPanelOpen size={16} />
        </button>
      ) : null}

      <aside
        className={`dawn-sidebar pointer-events-auto fixed inset-y-3 left-3 z-40 hidden w-[228px] flex-col steel-plate rounded-[1.35rem] px-3 py-4 md:flex ${
          sidebarOpen ? "" : "is-closed"
        }`}
      >
        <div className="flex items-center justify-between gap-1 px-1">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5 py-1" aria-label="Dawn">
            <DawnSquare size={28} />
            <span className="font-display text-lg tracking-tight text-white">
              Dawn
            </span>
          </Link>
          <button
            type="button"
            onClick={toggleSidebar}
            className="sidebar-toggle"
            aria-label="Hide sidebar"
            title="Hide sidebar"
          >
            <IconPanelClose size={16} />
          </button>
        </div>
        <nav className="mt-6 flex min-h-0 flex-1 flex-col gap-0.5" aria-label="Primary">
          {PRIMARY.map((l) => {
            const isActive = active === l.key;
            return (
              <Link
                key={l.key}
                href={l.href}
                prefetch
                className={`inline-flex items-center gap-2.5 rounded-full px-3 py-2 text-[13px] transition ${
                  isActive
                    ? "bg-[var(--color-dawn)]/12 font-medium text-white"
                    : "text-[#9aa8b5] hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                <NavGlyph Icon={l.Icon} active={isActive} size={16} />
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 pt-3">
          <Link
            href="/settings"
            prefetch
            className={`inline-flex w-full items-center gap-2.5 rounded-full px-3 py-2 text-[13px] transition ${
              active === "settings"
                ? "bg-[var(--color-dawn)]/12 font-medium text-white"
                : "text-[#9aa8b5] hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            <NavGlyph Icon={SettingsIcon} active={active === "settings"} size={16} />
            Settings
          </Link>
          <div className="border-t border-white/[0.07] pt-3">
            <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[#6d8090]">
              User account
            </p>
            <SidebarAccount />
          </div>
        </div>
      </aside>

      <header className="mobile-topbar">
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2"
          aria-label="Dawn"
        >
          <DawnSquare size={26} />
          <span className="truncate font-display text-[17px] tracking-tight text-white">
            {MOBILE.find((l) => l.key === active)?.label ||
              DESKTOP.find((l) => l.key === active)?.label ||
              "Dawn"}
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-0.5">
          <Link
            href="/leaderboard"
            className={`flex h-9 w-9 items-center justify-center rounded-full ${
              active === "leaderboard"
                ? "text-[var(--color-dawn)]"
                : "text-[var(--color-mist)]"
            }`}
            aria-label="Board"
          >
            <FlameIcon size={20} />
          </Link>
          <Link
            href="/circle"
            className={`flex h-9 w-9 items-center justify-center rounded-full ${
              active === "circle"
                ? "text-[var(--color-dawn)]"
                : "text-[var(--color-mist)]"
            }`}
            aria-label="Friends"
          >
            <UsersIcon size={20} />
          </Link>
          <Link
            href="/settings"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            aria-label="Your account"
          >
            {data?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.user.image}
                alt=""
                className="h-8 w-8 rounded-full border border-white/20 object-cover"
              />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-[13px] font-medium text-white">
                {(data?.user?.name || "?").slice(0, 1).toUpperCase()}
              </span>
            )}
          </Link>
        </div>
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
