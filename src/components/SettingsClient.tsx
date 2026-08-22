"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { HabitStudio } from "@/components/HabitStudio";
import { GoalsManager } from "@/components/GoalsManager";
import { RemindersManager } from "@/components/RemindersManager";
import { StudyCareManager } from "@/components/StudyCareManager";
import { ProfileSettings } from "@/components/ProfileSettings";
import { DiscordSetup } from "@/components/DiscordSetup";
import { BotMessagesSettings } from "@/components/BotMessagesSettings";
import { MissionSetup } from "@/components/MissionSetup";
import { MorningClockSettings } from "@/components/MorningClockSettings";

const TABS = [
  { id: "morning", label: "Morning" },
  { id: "you", label: "You" },
  { id: "discord", label: "Discord" },
  { id: "bot", label: "Bot messages" },
  { id: "mission", label: "Mission" },
  { id: "habits", label: "Habits" },
  { id: "reminders", label: "Reminders" },
  { id: "goals", label: "Goals" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function tabFromSearch(search: { get: (key: string) => string | null } | null): TabId {
  const t = search?.get("tab");
  if (t === "profile") return "you";
  if (t && TABS.some((x) => x.id === t)) return t as TabId;
  return "morning";
}

export function SettingsClient() {
  const { data: session, update } = useSession();
  const search = useSearchParams();
  const [tab, setTab] = useState<TabId>(() => tabFromSearch(search));
  const [wakeGoal, setWakeGoal] = useState("06:00");
  const [sleepGoal, setSleepGoal] = useState("23:00");

  useEffect(() => {
    const t = search?.get("tab");
    // legacy aliases
    if (t === "profile") {
      setTab("you");
      return;
    }
    if (t && TABS.some((x) => x.id === t)) {
      setTab(t as TabId);
    }
  }, [search]);

  useEffect(() => {
    if (session?.user?.wakeGoal) setWakeGoal(session.user.wakeGoal);
    if (session?.user?.sleepGoal) setSleepGoal(session.user.sleepGoal);
  }, [session?.user?.wakeGoal, session?.user?.sleepGoal]);

  return (
    <main className="dawn-bg relative min-h-screen">
      <div className="app-shell relative z-10 mx-auto w-full max-w-xl md:mx-0 md:max-w-none">
        <AppNav active="settings" />
        <div className="app-page-wide mt-8 animate-rise sm:mt-10">
          <p className="ui-kicker">Settings</p>
          <h1 className="ui-title mt-3">Make Dawn fit you</h1>
          <p className="ui-sub mt-3">
            Wake time first — then habits, reminders, Discord, and your mission.
            Each tab has one job.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link
              href="/circle"
              className="ui-card px-4 py-4"
            >
              <p className="text-sm font-medium text-white">Friends</p>
              <p className="mt-1 text-xs text-[var(--color-mist)]">
                Add by invite code, Discord, or same server — then see the rank
                board.
              </p>
            </Link>
            <Link
              href="/leaderboard"
              className="ui-card px-4 py-4"
            >
              <p className="text-sm font-medium text-white">Board</p>
              <p className="mt-1 text-xs text-[var(--color-mist)]">
                Rank habit consistency, study hours, or both combined.
              </p>
            </Link>
          </div>

          <div className="mt-8 md:mt-10 md:grid md:grid-cols-[13.75rem_minmax(0,1fr)] md:items-start md:gap-8 lg:gap-10">
            <div
              role="tablist"
              className="flex flex-wrap gap-1.5 md:sticky md:top-6 md:flex-col md:flex-nowrap md:gap-0.5"
            >
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => {
                    setTab(t.id);
                    const url = new URL(window.location.href);
                    url.searchParams.set("tab", t.id);
                    window.history.replaceState({}, "", url.toString());
                  }}
                  className={`ui-chip shrink-0 md:w-full md:justify-start md:rounded-xl ${
                    tab === t.id
                      ? "is-on md:!border-transparent md:!bg-[var(--color-dawn)]/15 md:!text-[var(--color-dawn)]"
                      : ""
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mt-8 min-w-0 rounded-2xl border border-white/[0.1] bg-[#0d131a] px-4 py-5 sm:px-6 sm:py-6 md:mt-0 md:px-8 md:py-8">
              {tab === "morning" ? <MorningClockSettings /> : null}

              {tab === "you" ? <ProfileSettings /> : null}

              {tab === "discord" ? <DiscordSetup /> : null}
              {tab === "bot" ? <BotMessagesSettings /> : null}

              {tab === "mission" ? (
                <div className="space-y-4">
                  <div>
                    <h2 className="font-display text-2xl text-white sm:text-3xl">
                      Mission
                    </h2>
                    <p className="mt-2 text-sm text-[var(--color-mist)]">
                      Add and edit missions here. Today only shows the name,
                      steps, and days left — tap Settings on a mission to open
                      it on this tab.
                    </p>
                  </div>
                  <MissionSetup focusId={search?.get("mission")} />
                </div>
              ) : null}

              {tab === "habits" ? (
                <div id="life-coach" className="scroll-mt-8">
                  <HabitStudio />
                </div>
              ) : null}

              {tab === "reminders" ? (
                <>
                  <RemindersManager />
                  <StudyCareManager />
                </>
              ) : null}

              {tab === "goals" ? (
                <div className="space-y-8">
                  <div>
                    <h2 className="font-display text-2xl text-white sm:text-3xl">
                      Named goals
                    </h2>
                    <p className="mt-2 text-sm text-[var(--color-mist)]">
                      Extra goals with optional times. Wake/sleep clock lives under
                      Morning.
                    </p>
                  </div>
                  <GoalsManager
                    wakeGoal={wakeGoal}
                    sleepGoal={sleepGoal}
                    onWakeSleepChange={(w, s) => {
                      setWakeGoal(w);
                      setSleepGoal(s);
                      void update();
                    }}
                  />
                </div>
              ) : null}

              <div className="mt-10 border-t border-white/[0.08] pt-5">
                <button
                  type="button"
                  onClick={() => {
                    void fetch("/api/settings", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ onboardingDone: false }),
                    }).then(() => {
                      window.location.href = "/onboarding";
                    });
                  }}
                  className="ui-btn-text text-sm"
                >
                  Redo first-time setup
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
