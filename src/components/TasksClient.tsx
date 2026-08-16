"use client";

import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { TodayTasks, type TodayTodo } from "@/components/TodayTasks";
import { UiEmpty } from "@/components/UiMessage";
import { formatLocalDate } from "@/lib/habits";
import { nextCalendarDate } from "@/lib/daily-loop";
import { isInWindow, nowMins } from "@/lib/habit-windows";

export function TasksClient() {
  const [today, setToday] = useState("");
  const [tomorrow, setTomorrow] = useState("");
  const [todayTodos, setTodayTodos] = useState<TodayTodo[]>([]);
  const [tomorrowTodos, setTomorrowTodos] = useState<TodayTodo[]>([]);
  const [sleepWindow, setSleepWindow] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/day-plan");
    if (!res.ok) {
      setError("Couldn’t load tasks.");
      setLoading(false);
      return;
    }
    const d = await res.json();
    setToday(d.today || formatLocalDate(new Date()));
    setTomorrow(d.tomorrow || nextCalendarDate(formatLocalDate(new Date())));
    setTodayTodos(d.todos || []);
    setTomorrowTodos(d.tomorrowTodos || []);
    if (d.sleepWindow?.start && d.sleepWindow?.end) {
      setSleepWindow({ start: d.sleepWindow.start, end: d.sleepWindow.end });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const inSleepWindow = sleepWindow
    ? isInWindow(nowMins(), sleepWindow.start, sleepWindow.end)
    : false;

  return (
    <main className="dawn-bg relative min-h-screen">
      <div className="app-shell relative z-10 mx-auto max-w-xl">
        <AppNav active="tasks" />
        <div className="mt-4 space-y-6 sm:mt-8">
          <header>
            <p className="ui-kicker">Tasks</p>
            <h1 className="ui-title mt-2">Named lists</h1>
            <p className="ui-sub mt-3">
              Pick a list, add a task. Flag is priority, clock is a reminder.
              Tap a task to open its steps.
            </p>
          </header>

          {loading ? (
            <div className="h-40 rounded-2xl bg-white/[0.04]" />
          ) : error ? (
            <UiEmpty
              kicker="Tasks"
              title="Couldn’t load"
              body={error}
              action={
                <button
                  type="button"
                  className="ui-btn ui-btn-primary"
                  onClick={() => {
                    setLoading(true);
                    void load();
                  }}
                >
                  Try again
                </button>
              }
            />
          ) : (
            <>
              <TodayTasks
                date={today}
                todos={todayTodos}
                onChange={setTodayTodos}
                onError={setError}
                title="Today"
                hint="Pick a list, type the task, set a flag or clock if you need them. Tap the task to add steps."
              />
              {inSleepWindow ? (
                <TodayTasks
                  date={tomorrow}
                  todos={tomorrowTodos}
                  onChange={setTomorrowTodos}
                  onError={setError}
                  title="Tomorrow — set this tonight"
                  hint="Three concrete tasks. That’s enough."
                />
              ) : (
                <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-[var(--color-mist)]">
                  {tomorrowTodos.length
                    ? `Tomorrow is set (${tomorrowTodos.length} task${
                        tomorrowTodos.length === 1 ? "" : "s"
                      }). `
                    : ""}
                  Set tomorrow opens in your sleep window
                  {sleepWindow
                    ? ` (${sleepWindow.start}–${sleepWindow.end})`
                    : ""}
                  .
                </p>
              )}
              <p className="text-xs text-[var(--color-mist)]">
                Clear today’s list: +18 XP. Set tomorrow for the first time:
                +12 XP. Close the night on Today to keep the streak.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
