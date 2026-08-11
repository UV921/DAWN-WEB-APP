"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { HabitStudio } from "@/components/HabitStudio";
import { GoalsManager } from "@/components/GoalsManager";
import { RemindersManager } from "@/components/RemindersManager";
import { ProfileSettings } from "@/components/ProfileSettings";
import { DiscordSetup } from "@/components/DiscordSetup";
import { MissionSetup } from "@/components/MissionSetup";
import { MorningClockSettings } from "@/components/MorningClockSettings";

const TABS = [
  { id: "morning", label: "Morning" },
  { id: "you", label: "You" },
  { id: "discord", label: "Discord" },
  { id: "mission", label: "Mission" },
  { id: "habits", label: "Habits" },
  { id: "reminders", label: "Reminders" },
  { id: "goals", label: "Goals" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function SettingsClient() {
  const { data: session, update } = useSession();
  const search = useSearchParams();
  const [tab, setTab] = useState<TabId>("morning");
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

  if (!session?.user) {
    return (
      <main className="dawn-bg flex min-h-screen items-center justify-center text-[var(--color-mist)]">
        Loading…
      </main>
    );
  }

  return (
    <main className="dawn-bg noise relative min-h-screen">
      <div className="app-shell relative z-10 mx-auto max-w-2xl">
        <AppNav active="settings" />
        <div className="mt-8 animate-rise sm:mt-12">
          <p className="ui-kicker">Settings</p>
          <h1 className="ui-title mt-3">Make Dawn fit you</h1>
          <p className="ui-sub mt-3">
            Wake time first — then habits, reminders, Discord, and your mission.
            Each tab has one job.
          </p>

          <div
            role="tablist"
            className="mt-8 flex gap-1 overflow-x-auto"
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
                className={`shrink-0 px-3 py-2 text-sm transition ${
                  tab === t.id
                    ? "text-[var(--color-dawn)]"
                    : "text-[var(--color-mist)] hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-8">
            {tab === "morning" ? <MorningClockSettings /> : null}

            {tab === "you" ? <ProfileSettings /> : null}

            {tab === "discord" ? <DiscordSetup /> : null}

            {tab === "mission" ? (
              <div className="space-y-4">
                <div>
                  <h2 className="font-display text-2xl text-white sm:text-3xl">
                    Mission
                  </h2>
                  <p className="mt-2 text-sm text-[var(--color-mist)]">
                    Pick length, habits, and daily tasks yourself — AI defaults
                    are optional.
                  </p>
                </div>
                <MissionSetup />
              </div>
            ) : null}

            {tab === "habits" ? (
              <div id="life-coach" className="scroll-mt-8">
                <HabitStudio />
              </div>
            ) : null}

            {tab === "reminders" ? <RemindersManager /> : null}

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
          </div>

          <div className="mt-12 pt-2">
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
    </main>
  );
}
