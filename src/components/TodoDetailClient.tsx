"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { UiEmpty, UiMessage } from "@/components/UiMessage";
import {
  IconChevronRight,
  IconClock,
  IconFlag,
  IconPlus,
  IconX,
} from "@/components/icons";
import { LIST_PRESETS, normalizeListTitle } from "@/lib/todo-lists";
import { normalizePriority, parseRemindAt } from "@/lib/todo-weight";

type Todo = {
  id: string;
  text: string;
  done: boolean;
  date: string;
  title: string;
  priority: string;
  remindAt: string | null;
  parentId: string | null;
};

const PRIORITIES = ["high", "medium", "low"] as const;

function flagClass(priority: string) {
  const p = normalizePriority(priority);
  if (p === "high") return "text-[var(--color-ember)]";
  if (p === "low") return "text-[var(--color-mist)]";
  return "text-[var(--color-dawn)]";
}

function friendlyDate(date: string, today: string) {
  if (!date) return "";
  if (date === today) return "Today";
  const d = new Date(`${date}T12:00:00`);
  const t = new Date(`${today}T12:00:00`);
  const diff = Math.round((t.getTime() - d.getTime()) / 86400000);
  if (diff === 1) return "Yesterday";
  if (diff === -1) return "Tomorrow";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(d.getFullYear() === t.getFullYear() ? {} : { year: "numeric" }),
  });
}

export function TodoDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [todo, setTodo] = useState<Todo | null>(null);
  const [children, setChildren] = useState<Todo[]>([]);
  const [parent, setParent] = useState<{ id: string; text: string } | null>(
    null
  );
  const [categories, setCategories] = useState<string[]>([]);
  const [today, setToday] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [stepText, setStepText] = useState("");
  const [catOpen, setCatOpen] = useState(false);
  const [newCat, setNewCat] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/todos/${id}`);
    if (res.status === 404) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError("Couldn’t load this task.");
      setLoading(false);
      return;
    }
    const d = await res.json();
    setTodo(d.todo);
    setDraft(d.todo?.text || "");
    setChildren(d.children || []);
    setParent(d.parent || null);
    setCategories(d.categories || []);
    setToday(d.today || "");
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/day-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error || "Couldn’t save that.");
      return false;
    }
    await load();
    return true;
  }

  async function toggle(target: Todo) {
    await patch({ id: target.id, done: !target.done });
  }

  async function saveText() {
    const text = draft.trim();
    if (!todo || !text || text === todo.text) return;
    await patch({ action: "update-todo", id: todo.id, text });
  }

  async function addStep() {
    const text = stepText.trim();
    if (!todo || !text) return;
    const ok = await patch({
      action: "add-subtask",
      parentId: todo.id,
      text,
    });
    if (ok) setStepText("");
  }

  async function remove() {
    if (!todo) return;
    const ok = await patch({ action: "delete-todo", id: todo.id });
    if (ok) router.push("/tasks");
  }

  if (loading) {
    return (
      <main className="dawn-bg relative min-h-screen">
        <div className="app-shell relative z-10 mx-auto w-full max-w-xl md:mx-0 md:max-w-none">
          <AppNav active="tasks" />
          <div className="app-page mt-8 h-48 rounded-2xl bg-white/[0.04]" />
        </div>
      </main>
    );
  }

  if (notFound || !todo) {
    return (
      <main className="dawn-bg relative min-h-screen">
        <div className="app-shell relative z-10 mx-auto w-full max-w-xl md:mx-0 md:max-w-none">
          <AppNav active="tasks" />
          <div className="app-page mt-8">
            <UiEmpty
              kicker="Task"
              title="Not here"
              body="This task was deleted, or it belongs to another account."
              action={
                <Link href="/tasks" className="ui-btn ui-btn-primary">
                  Back to tasks
                </Link>
              }
            />
          </div>
        </div>
      </main>
    );
  }

  const pri = normalizePriority(todo.priority);
  const doneKids = children.filter((k) => k.done).length;
  const allCategories = [
    ...new Set([...LIST_PRESETS, ...categories, todo.title]),
  ];

  return (
    <main className="dawn-bg relative min-h-screen">
      <div className="app-shell relative z-10 mx-auto w-full max-w-xl md:mx-0 md:max-w-none">
        <AppNav active="tasks" />
        <div className="app-page mt-4 space-y-5 sm:mt-8">
          <nav className="flex items-center gap-1 text-xs text-[var(--color-mist)]">
            <Link href="/tasks" className="hover:text-white">
              Tasks
            </Link>
            <IconChevronRight size={12} />
            <span className="truncate text-[var(--color-cloud)]">
              {todo.title}
            </span>
          </nav>

          {parent ? (
            <Link
              href={`/tasks/${parent.id}`}
              className="flex items-center gap-1.5 text-sm text-[var(--color-mist)] hover:text-white"
            >
              Step of “{parent.text}”
            </Link>
          ) : null}

          <header className="flex items-start gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggle(todo)}
              className="mt-1 shrink-0"
              aria-label={todo.done ? "Mark not done" : "Mark done"}
            >
              <span className={`ui-check !h-6 !w-6 ${todo.done ? "is-on" : ""}`}>
                ✓
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => void saveText()}
                rows={2}
                maxLength={120}
                className={`w-full resize-none border-0 bg-transparent font-display text-2xl leading-snug outline-none ${
                  todo.done ? "text-[var(--color-mist)] line-through" : "text-white"
                }`}
                aria-label="Task text"
              />
              <p className="text-sm text-[var(--color-mist)]">
                {friendlyDate(todo.date, today)}
                <span className="ml-2 font-mono text-xs">{todo.date}</span>
              </p>
            </div>
          </header>

          {error ? <UiMessage tone="error">{error}</UiMessage> : null}

          <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-[var(--color-mist)]">Category</span>
              <button
                type="button"
                onClick={() => setCatOpen((v) => !v)}
                className="rounded-full border border-white/15 px-3 py-1.5 text-[13px] text-white hover:border-[var(--color-dawn)]/50"
              >
                {todo.title}
              </button>
            </div>
            {catOpen ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {allCategories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setCatOpen(false);
                        void patch({
                          action: "update-todo",
                          id: todo.id,
                          title: c,
                        });
                      }}
                      className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                        c === todo.title
                          ? "bg-[var(--color-dawn)] text-[var(--color-night)]"
                          : "border border-white/12 text-[var(--color-mist)] hover:text-white"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const name = normalizeListTitle(newCat);
                    if (!newCat.trim()) return;
                    setCatOpen(false);
                    setNewCat("");
                    void patch({
                      action: "update-todo",
                      id: todo.id,
                      title: name,
                    });
                  }}
                >
                  <input
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    placeholder="New category"
                    maxLength={40}
                    className="ui-field !py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={busy || !newCat.trim()}
                    className="ui-btn ui-btn-ghost !min-h-9 shrink-0 !px-4 text-[13px]"
                  >
                    Add
                  </button>
                </form>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-[var(--color-mist)]">Priority</span>
              <div className="flex gap-1.5">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void patch({
                        action: "update-todo",
                        id: todo.id,
                        priority: p,
                      })
                    }
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                      p === pri
                        ? "bg-white/10 " + flagClass(p)
                        : "text-[var(--color-mist)] hover:text-white"
                    }`}
                  >
                    <IconFlag size={11} />
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-[var(--color-mist)]">Reminder</span>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={todo.remindAt || ""}
                  onChange={(e) =>
                    void patch({
                      action: "update-todo",
                      id: todo.id,
                      remindAt: parseRemindAt(e.target.value),
                    })
                  }
                  className="ui-field !w-auto !py-1.5 text-sm"
                  aria-label="Reminder time"
                />
                {todo.remindAt ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void patch({
                        action: "update-todo",
                        id: todo.id,
                        remindAt: null,
                      })
                    }
                    className="text-[12px] text-[var(--color-mist)] hover:text-white"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-[var(--color-mist)]">Day</span>
              <input
                type="date"
                value={todo.date}
                onChange={(e) =>
                  void patch({
                    action: "update-todo",
                    id: todo.id,
                    date: e.target.value,
                  })
                }
                className="ui-field !w-auto !py-1.5 text-sm"
                aria-label="Task date"
              />
            </div>
          </section>

          {!todo.parentId ? (
            <section>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-[15px] font-medium text-white">Steps</h2>
                {children.length ? (
                  <span className="text-xs tabular-nums text-[var(--color-mist)]">
                    {doneKids}/{children.length}
                  </span>
                ) : null}
              </div>
              {children.length ? (
                <ul className="overflow-hidden rounded-2xl border border-white/[0.08]">
                  {children.map((k) => (
                    <li
                      key={k.id}
                      className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2 last:border-0"
                    >
                      <button
                        type="button"
                        disabled={busy}
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
                        className={`min-w-0 flex-1 text-[14px] ${
                          k.done
                            ? "text-[var(--color-mist)] line-through"
                            : "text-[#d6e2ec]"
                        }`}
                      >
                        {k.text}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void patch({ action: "delete-todo", id: k.id })
                        }
                        className="shrink-0 text-[var(--color-mist)] hover:text-white"
                        aria-label={`Remove ${k.text}`}
                      >
                        <IconX size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--color-mist)]">
                  Break this into smaller steps.
                </p>
              )}
              {children.length < 8 ? (
                <form
                  className="mt-2 flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void addStep();
                  }}
                >
                  <input
                    value={stepText}
                    onChange={(e) => setStepText(e.target.value)}
                    placeholder="Add a step"
                    maxLength={120}
                    autoComplete="off"
                    className="ui-field !py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={busy || !stepText.trim()}
                    className="ui-btn ui-btn-ghost !min-h-9 shrink-0 !px-4 text-[13px]"
                  >
                    <IconPlus size={13} />
                    Add
                  </button>
                </form>
              ) : null}
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggle(todo)}
              className="ui-btn ui-btn-primary flex-1"
            >
              {todo.done ? "Mark not done" : "Mark done"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove()}
              className="ui-btn ui-btn-ghost text-[var(--color-ember)]"
            >
              Delete
            </button>
          </div>

          <p className="text-xs text-[var(--color-mist)]">
            <IconClock size={11} className="mr-1 inline" />
            Changes save as you make them.
          </p>
        </div>
      </div>
    </main>
  );
}
