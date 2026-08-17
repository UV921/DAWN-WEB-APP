"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { UiEmpty } from "@/components/UiMessage";
import {
  IconCheck,
  IconChevronRight,
  IconClock,
  IconFlag,
} from "@/components/icons";

type Todo = {
  id: string;
  text: string;
  done: boolean;
  title: string;
  priority: string;
  remindAt: string | null;
  parentId: string | null;
};

type Slice = { name: string; total: number; done: number };

type DayData = {
  date: string;
  today: string;
  prev: string;
  next: string | null;
  plan: { goalText: string; wakeGoal: string | null; reviewed: boolean } | null;
  log: { wakeTime: string | null; bedtime: string | null; notes: string | null } | null;
  wakeGoal: string;
  sleepGoal: string;
  habits: { key: string; label: string; done: boolean }[];
  habitsDone: number;
  todos: Todo[];
  summary: {
    total: number;
    done: number;
    allTotal: number;
    allDone: number;
    byCategory: Slice[];
    byPriority: Slice[];
  };
  studyMinutes: number;
};

function friendlyDay(date: string, today: string) {
  const d = new Date(`${date}T12:00:00`);
  const t = new Date(`${today}T12:00:00`);
  const diff = Math.round((t.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff === -1) return "Tomorrow";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(d.getFullYear() === t.getFullYear() ? {} : { year: "numeric" }),
  });
}

function hours(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="ui-card ui-card-compact !text-left">
      <p className="text-xs text-[var(--color-mist)]">{label}</p>
      <p className="font-display mt-1 text-xl text-white">{value}</p>
      {hint ? (
        <p className="mt-0.5 text-[11px] text-[var(--color-mist)]">{hint}</p>
      ) : null}
    </div>
  );
}

function Bar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-[var(--color-dawn)] transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function DayReportClient({ date }: { date: string }) {
  const [data, setData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/day/${date}`);
    if (!res.ok) {
      setFailed(true);
      setLoading(false);
      return;
    }
    setData(await res.json());
    setFailed(false);
    setLoading(false);
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(t: Todo) {
    await fetch("/api/day-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, done: !t.done }),
    });
    await load();
  }

  const shell = (inner: React.ReactNode) => (
    <main className="dawn-bg relative min-h-screen">
      <div className="app-shell relative z-10 mx-auto w-full max-w-xl md:mx-0 md:max-w-none">
        <AppNav active="tasks" />
        <div className="app-page mt-4 space-y-5 sm:mt-8">{inner}</div>
      </div>
    </main>
  );

  if (loading) {
    return shell(<div className="h-64 rounded-2xl bg-white/[0.04]" />);
  }

  if (failed || !data) {
    return shell(
      <UiEmpty
        kicker="Day"
        title="Couldn’t load that day"
        body="Check the date and try again."
        action={
          <Link href="/tasks" className="ui-btn ui-btn-primary">
            Back to tasks
          </Link>
        }
      />
    );
  }

  const { summary, log, plan } = data;
  const roots = data.todos.filter((t) => !t.parentId);
  const kids = new Map<string, Todo[]>();
  for (const t of data.todos) {
    if (!t.parentId) continue;
    kids.set(t.parentId, [...(kids.get(t.parentId) || []), t]);
  }
  const pct = summary.total
    ? Math.round((summary.done / summary.total) * 100)
    : 0;
  const wokeOnTime =
    log?.wakeTime && data.wakeGoal
      ? log.wakeTime <= data.wakeGoal
      : null;

  return shell(
    <>
      <nav className="flex items-center gap-1 text-xs text-[var(--color-mist)]">
        <Link href="/tasks" className="hover:text-white">
          Tasks
        </Link>
        <IconChevronRight size={12} />
        <span className="text-[var(--color-cloud)]">Day report</span>
      </nav>

      <header>
        <p className="ui-kicker">{data.date}</p>
        <h1 className="ui-title mt-2">
          {friendlyDay(data.date, data.today)}
        </h1>
        {plan?.goalText ? (
          <p className="ui-sub mt-2">
            {plan.goalText}
          </p>
        ) : null}
      </header>

      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/tasks/day/${data.prev}`}
          className="ui-btn ui-btn-ghost !min-h-9 !px-4 text-[13px]"
        >
          Previous day
        </Link>
        {data.next ? (
          <Link
            href={`/tasks/day/${data.next}`}
            className="ui-btn ui-btn-ghost !min-h-9 !px-4 text-[13px]"
          >
            Next day
          </Link>
        ) : null}
      </div>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Tasks"
          value={`${summary.done}/${summary.total}`}
          hint={summary.total ? `${pct}% done` : "none listed"}
        />
        <Stat
          label="Habits"
          value={`${data.habitsDone}/${data.habits.length}`}
          hint={
            data.habits.length && data.habitsDone === data.habits.length
              ? "all done"
              : undefined
          }
        />
        <Stat
          label="Woke"
          value={log?.wakeTime || "—"}
          hint={
            wokeOnTime === null
              ? `goal ${data.wakeGoal}`
              : wokeOnTime
                ? `on time · goal ${data.wakeGoal}`
                : `late · goal ${data.wakeGoal}`
          }
        />
        <Stat
          label="Slept"
          value={log?.bedtime || "—"}
          hint={`goal ${data.sleepGoal}`}
        />
      </section>

      {data.studyMinutes > 0 ? (
        <p className="text-sm text-[var(--color-mist)]">
          Study time in voice rooms:{" "}
          <span className="text-white">{hours(data.studyMinutes)}</span>
        </p>
      ) : null}

      {summary.total > 0 ? (
        <section className="space-y-4 steel-plate rounded-2xl bg-white/[0.03] p-4">
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-[15px] font-medium text-white">
                How the day went
              </h2>
              <span className="text-xs tabular-nums text-[var(--color-mist)]">
                {pct}%
              </span>
            </div>
            <Bar done={summary.done} total={summary.total} />
          </div>

          {summary.byCategory.length > 1 ? (
            <div>
              <p className="mb-2 text-xs text-[var(--color-mist)]">
                By category
              </p>
              <ul className="space-y-2">
                {summary.byCategory.map((c) => (
                  <li key={c.name}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
                      <span className="min-w-0 truncate text-[#d6e2ec]">
                        {c.name}
                      </span>
                      <span className="shrink-0 tabular-nums text-[var(--color-mist)]">
                        {c.done}/{c.total}
                      </span>
                    </div>
                    <Bar done={c.done} total={c.total} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {summary.byPriority.length > 0 ? (
            <div className="flex flex-wrap gap-2 text-[12px]">
              {summary.byPriority.map((p) => (
                <span
                  key={p.name}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1 text-[var(--color-mist)]"
                >
                  <IconFlag
                    size={11}
                    className={
                      p.name === "high"
                        ? "text-[var(--color-ember)]"
                        : p.name === "low"
                          ? "text-[var(--color-mist)]"
                          : "text-[var(--color-dawn)]"
                    }
                  />
                  {p.name} {p.done}/{p.total}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-[15px] font-medium text-white">Tasks</h2>
        {roots.length === 0 ? (
          <p className="text-sm text-[var(--color-mist)]">
            Nothing was listed for this day.
          </p>
        ) : (
          <ul className="overflow-hidden steel-plate rounded-2xl">
            {roots.map((t) => {
              const sub = kids.get(t.id) || [];
              return (
                <li
                  key={t.id}
                  className="border-b border-white/[0.06] last:border-0"
                >
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => void toggle(t)}
                      className="shrink-0"
                      aria-label={t.done ? `Undo ${t.text}` : `Complete ${t.text}`}
                    >
                      <span className={`ui-check ${t.done ? "is-on" : ""}`}>
                        ✓
                      </span>
                    </button>
                    <Link
                      href={`/tasks/${t.id}`}
                      className="flex min-w-0 flex-1 items-center gap-2"
                    >
                      <span
                        className={`min-w-0 flex-1 truncate text-[14px] ${
                          t.done
                            ? "text-[var(--color-mist)] line-through"
                            : "text-white"
                        }`}
                      >
                        {t.text}
                      </span>
                      {t.title && t.title !== "Today" ? (
                        <span className="shrink-0 rounded-full border border-white/12 px-2 py-0.5 text-[10px] text-[var(--color-mist)]">
                          {t.title}
                        </span>
                      ) : null}
                      {t.remindAt ? (
                        <span className="inline-flex shrink-0 items-center gap-1 tabular-nums text-[11px] text-[var(--color-mist)]">
                          <IconClock size={11} />
                          {t.remindAt}
                        </span>
                      ) : null}
                      <IconChevronRight
                        size={13}
                        className="shrink-0 text-[var(--color-mist)]/50"
                      />
                    </Link>
                  </div>
                  {sub.length ? (
                    <ul className="border-t border-white/[0.05] py-1 pl-11 pr-3">
                      {sub.map((k) => (
                        <li
                          key={k.id}
                          className="flex items-center gap-2 py-1 text-[13px]"
                        >
                          <button
                            type="button"
                            onClick={() => void toggle(k)}
                            className="shrink-0"
                            aria-label={k.done ? `Undo ${k.text}` : `Complete ${k.text}`}
                          >
                            <span
                              className={`ui-check !h-4 !w-4 ${k.done ? "is-on" : ""}`}
                            >
                              ✓
                            </span>
                          </button>
                          <span
                            className={
                              k.done
                                ? "text-[var(--color-mist)] line-through"
                                : "text-[#d6e2ec]"
                            }
                          >
                            {k.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {data.habits.length ? (
        <section>
          <h2 className="mb-2 text-[15px] font-medium text-white">Habits</h2>
          <ul className="flex flex-wrap gap-2">
            {data.habits.map((h) => (
              <li
                key={h.key}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] ${
                  h.done
                    ? "bg-[var(--color-dawn)]/15 text-[var(--color-dawn)]"
                    : "border border-white/12 text-[var(--color-mist)]"
                }`}
              >
                {h.done ? <IconCheck size={12} strokeWidth={2.4} /> : null}
                {h.label}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {log?.notes ? (
        <section>
          <h2 className="mb-1 text-[15px] font-medium text-white">Notes</h2>
          <p className="text-sm text-[var(--color-cloud)]">{log.notes}</p>
        </section>
      ) : null}
    </>
  );
}
