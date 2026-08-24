"use client";

import { useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import {
  ProgressDetail,
  type ReportTodo,
  type TodoStat,
} from "@/components/ProgressDetail";
import type { HabitDef, HabitLogLike } from "@/lib/habits";
import type { StudyStats } from "@/components/StudyStatusPanel";
import type { ReportRange } from "@/lib/progress-brief";
import type { MissionPublic } from "@/lib/missions";
import { clampDayIso, isDayIso } from "@/lib/day-progress";

function readDayQuery(): string {
  if (typeof window === "undefined") return "";
  const day = new URLSearchParams(window.location.search).get("day") || "";
  return isDayIso(day) ? day : "";
}

function writeDayQuery(date: string, today: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!date || date === today) url.searchParams.delete("day");
  else url.searchParams.set("day", date);
  const next = `${url.pathname}${url.search}`;
  const cur = `${window.location.pathname}${window.location.search}`;
  if (next !== cur) window.history.replaceState(null, "", next);
}

export function ProgressClient() {
  const [logs, setLogs] = useState<HabitLogLike[]>([]);
  const [habits, setHabits] = useState<HabitDef[]>([]);
  const [todoStats, setTodoStats] = useState<TodoStat[]>([]);
  const [todayTodos, setTodayTodos] = useState<ReportTodo[]>([]);
  const [dayTodos, setDayTodos] = useState<ReportTodo[]>([]);
  const [dayNotes, setDayNotes] = useState<string | null>(null);
  const [dayGoal, setDayGoal] = useState<string | null>(null);
  const [study, setStudy] = useState<StudyStats | null>(null);
  const [missions, setMissions] = useState<MissionPublic[]>([]);
  const [missionHistory, setMissionHistory] = useState<MissionPublic[]>([]);
  const [missionToday, setMissionToday] = useState("");
  const [range, setRange] = useState<ReportRange>("today");
  const [loading, setLoading] = useState(true);
  const [readyDays, setReadyDays] = useState(0);
  const [todayIso, setTodayIso] = useState("");
  const [wakeGoal, setWakeGoal] = useState("06:00");
  const [sleepGoal, setSleepGoal] = useState("23:00");
  const [selectedDate, setSelectedDate] = useState(readDayQuery);

  useEffect(() => {
    if (readyDays >= 365) return;
    let cancelled = false;
    if (readyDays === 0) setLoading(true);
    const days = 365;
    void Promise.all([
      fetch(`/api/habits?days=${days}`).then((r) => r.json()),
      fetch(`/api/study?days=${days}`, { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : null
      ),
      readyDays === 0
        ? fetch("/api/mission").then((r) => (r.ok ? r.json() : null))
        : Promise.resolve(null),
    ])
      .then(([d, s, m]: [
        {
          logs?: HabitLogLike[];
          habits?: HabitDef[];
          todoStats?: TodoStat[];
          todayTodos?: ReportTodo[];
          today?: string;
          wakeGoal?: string;
          sleepGoal?: string;
        },
        StudyStats | null,
        {
          missions?: MissionPublic[];
          history?: MissionPublic[];
          today?: string;
        } | null,
      ]) => {
        if (cancelled) return;
        setLogs(d.logs || []);
        setHabits(d.habits || []);
        setTodoStats(d.todoStats || []);
        setTodayTodos(d.todayTodos || []);
        if (d.today) {
          setTodayIso(d.today);
          setSelectedDate((prev) => clampDayIso(prev || d.today!, d.today!));
        }
        if (d.wakeGoal) setWakeGoal(d.wakeGoal);
        if (d.sleepGoal) setSleepGoal(d.sleepGoal);
        if (s?.status) setStudy(s);
        if (m) {
          setMissions(m.missions || []);
          setMissionHistory(m.history || []);
          if (typeof m.today === "string") setMissionToday(m.today);
        }
        setReadyDays(days);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [readyDays]);

  useEffect(() => {
    if (!selectedDate || !todayIso) return;
    writeDayQuery(selectedDate, todayIso);
    if (selectedDate === todayIso) {
      setDayTodos(todayTodos);
      setDayNotes(null);
      setDayGoal(null);
      return;
    }
    let cancelled = false;
    void fetch(`/api/day/${selectedDate}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (d: {
          todos?: ReportTodo[];
          log?: { notes?: string | null } | null;
          plan?: { goalText?: string | null } | null;
        } | null) => {
          if (cancelled || !d) return;
          setDayTodos(d.todos || []);
          setDayNotes(d.log?.notes || null);
          setDayGoal(d.plan?.goalText || null);
        }
      );
    return () => {
      cancelled = true;
    };
  }, [selectedDate, todayIso, todayTodos]);

  function pickDay(date: string) {
    if (!todayIso) return;
    setSelectedDate(clampDayIso(date, todayIso));
    setRange("today");
  }

  const hasAnything =
    logs.length > 0 ||
    todoStats.length > 0 ||
    todayTodos.length > 0 ||
    missions.length > 0 ||
    Boolean(
      study?.hourly?.length || study?.weekMinutes || study?.today?.minutes
    );

  return (
    <main className="dawn-bg relative min-h-screen">
      <div className="app-shell relative z-10 mx-auto w-full max-w-xl md:mx-0 md:max-w-none">
        <AppNav active="progress" />
        <div className="app-page-wide mt-8 animate-rise">
          <p className="ui-kicker">Progress</p>
          <h1 className="ui-title mt-2">How you’re doing</h1>
          <p className="ui-sub mt-3 max-w-xl">
            Open any day for the ratios — wake, habits, tasks, study, sleep —
            with graphs against the week before. Then zoom out to 7 days, 30
            days, or a year.
          </p>
          {loading ? (
            <p className="mt-12 text-[var(--color-mist)]">Reading your days…</p>
          ) : !hasAnything ? (
            <div className="mt-8 space-y-6">
              <p className="max-w-md text-[var(--color-mist)]">
                Nothing to score yet. Go to{" "}
                <a href="/dashboard" className="ui-btn-text">
                  Today
                </a>
                , log your wake, and close one habit. After a few days this page
                will show each day’s ratios and which weekday is weakest.
              </p>
            </div>
          ) : (
            <div className="mt-8">
              <ProgressDetail
                logs={logs}
                habits={habits}
                todoStats={todoStats}
                study={study}
                todayTodos={todayTodos}
                dayTodos={dayTodos}
                dayNotes={dayNotes}
                dayGoal={dayGoal}
                range={range}
                onRange={setRange}
                selectedDate={selectedDate || todayIso}
                onSelectDate={pickDay}
                todayIso={todayIso}
                wakeGoal={wakeGoal}
                sleepGoal={sleepGoal}
                missions={missions}
                missionHistory={missionHistory}
                missionToday={missionToday}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
