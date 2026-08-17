"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconX,
} from "@/components/icons";

type HistoryTodo = {
  id: string;
  text: string;
  done: boolean;
  title: string;
  priority: string;
  remindAt: string | null;
};

type DayGroup = {
  date: string;
  total: number;
  done: number;
  todos: HistoryTodo[];
};

function friendlyDay(date: string, today: string) {
  if (date === today) return "Today";
  const d = new Date(`${date}T12:00:00`);
  const t = new Date(`${today}T12:00:00`);
  const diff = Math.round((t.getTime() - d.getTime()) / 86400000);
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(d.getFullYear() === t.getFullYear() ? {} : { year: "numeric" }),
  });
}

/** Browse and search every task list you've ever written. */
export function TodoHistory() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [days, setDays] = useState<DayGroup[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [today, setToday] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const reqId = useRef(0);

  const load = useCallback(async (q: string, d: string, cat: string) => {
    const mine = ++reqId.current;
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (d) params.set("date", d);
    if (cat) params.set("category", cat);
    const res = await fetch(`/api/todos/history?${params.toString()}`);
    if (!res.ok) {
      if (mine === reqId.current) setLoading(false);
      return;
    }
    const data = await res.json();
    // A slower earlier request must not overwrite newer results.
    if (mine !== reqId.current) return;
    setDays(data.days || []);
    setToday(data.today || "");
    setCategories(data.categories || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => void load(query, date, category), 220);
    return () => window.clearTimeout(id);
  }, [open, query, date, category, load]);

  const totals = useMemo(() => {
    const tasks = days.reduce((n, d) => n + d.total, 0);
    const done = days.reduce((n, d) => n + d.done, 0);
    return { tasks, done };
  }, [days]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="steel-plate flex w-full items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3 text-left transition hover:bg-white/[0.06]"
      >
        <span>
          <span className="block text-[15px] font-medium text-white">
            Past tasks
          </span>
          <span className="mt-0.5 block text-xs text-[var(--color-mist)]">
            Search any day, see what you finished.
          </span>
        </span>
        <IconChevronDown size={16} className="text-[var(--color-mist)]" />
      </button>
    );
  }

  return (
    <section className="steel-plate rounded-2xl bg-white/[0.03] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-medium text-white">Past tasks</h2>
          <p className="mt-0.5 text-xs text-[var(--color-mist)]">
            {loading
              ? "Looking…"
              : days.length
                ? `${totals.done}/${totals.tasks} done across ${days.length} day${days.length === 1 ? "" : "s"}`
                : "Nothing found."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="shrink-0 text-[13px] text-[var(--color-mist)] hover:text-white"
        >
          Close
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div className="flex min-w-0 flex-1 items-center gap-2 steel-plate-sm rounded-xl bg-white/[0.04] px-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your tasks"
            maxLength={80}
            autoComplete="off"
            className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-[var(--color-mist)]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="shrink-0 text-[var(--color-mist)] hover:text-white"
              aria-label="Clear search"
            >
              <IconX size={13} />
            </button>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <input
            type="date"
            value={date}
            max={today || undefined}
            onChange={(e) => setDate(e.target.value)}
            className="ui-field !w-auto !py-2 text-sm"
            aria-label="Jump to a date"
          />
          {date ? (
            <button
              type="button"
              onClick={() => setDate("")}
              className="text-[13px] text-[var(--color-mist)] hover:text-white"
            >
              All
            </button>
          ) : null}
        </div>
      </div>

      {categories.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategory("")}
            className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${
              category === ""
                ? "bg-[var(--color-dawn)] text-[var(--color-night)]"
                : "border border-white/12 text-[var(--color-mist)] hover:text-white"
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(category === c ? "" : c)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${
                category === c
                  ? "bg-[var(--color-dawn)] text-[var(--color-night)]"
                  : "border border-white/12 text-[var(--color-mist)] hover:text-white"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      ) : null}

      {days.length === 0 && !loading ? (
        <p className="mt-4 text-sm text-[var(--color-mist)]">
          {query || date || category
            ? "No tasks match that."
            : "Once you finish some days, they show up here."}
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {days.map((d) => {
            const isOpen =
              expanded === d.date ||
              Boolean(query) ||
              Boolean(date) ||
              Boolean(category);
            return (
              <li
                key={d.date}
                className="steel-plate-sm overflow-hidden rounded-xl"
              >
                <div className="flex items-center gap-1 px-1">
                  <Link
                    href={`/tasks/day/${d.date}`}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2.5 hover:bg-white/[0.04]"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-white">
                      {friendlyDay(d.date, today)}
                      <span className="ml-2 font-mono text-[11px] text-[var(--color-mist)]">
                        {d.date}
                      </span>
                    </span>
                    {d.done === d.total ? (
                      <span
                        className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--color-dawn)] text-[var(--color-night)]"
                        title="All done"
                      >
                        <IconCheck size={11} strokeWidth={2.6} />
                      </span>
                    ) : (
                      <span className="shrink-0 text-[12px] tabular-nums text-[var(--color-mist)]">
                        {d.done}/{d.total}
                      </span>
                    )}
                    <IconChevronRight
                      size={13}
                      className="shrink-0 text-[var(--color-mist)]/50"
                    />
                  </Link>
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded(expanded === d.date ? null : d.date)
                    }
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--color-mist)] hover:bg-white/[0.04] hover:text-white"
                    aria-label={
                      isOpen ? `Hide ${d.date} tasks` : `Show ${d.date} tasks`
                    }
                    aria-expanded={isOpen}
                  >
                    <IconChevronDown
                      size={14}
                      className={`transition ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
                {isOpen ? (
                  <ul className="border-t border-white/[0.06] px-3 py-2">
                    {d.todos.map((t) => (
                      <li key={t.id}>
                        <Link
                          href={`/tasks/${t.id}`}
                          className="-mx-1 flex items-center gap-2 rounded-lg px-1 py-1.5 text-[13px] hover:bg-white/[0.05]"
                        >
                          <span
                            className={`ui-check !h-4 !w-4 ${t.done ? "is-on" : ""}`}
                          >
                            ✓
                          </span>
                          <span
                            className={`min-w-0 flex-1 truncate ${
                              t.done
                                ? "text-[var(--color-mist)] line-through"
                                : "text-[#d6e2ec]"
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
  );
}
