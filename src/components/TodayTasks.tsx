"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { IconPlus, IconX } from "@/components/icons";

export type TodayTodo = { id: string; text: string; done: boolean };

type Props = {
  date: string;
  todos: TodayTodo[];
  onChange: Dispatch<SetStateAction<TodayTodo[]>>;
  onError?: (text: string) => void;
  title?: string;
  hint?: string;
  /** When false, only check off — adding lives on the Tasks tab. */
  allowAdd?: boolean;
  addHref?: string;
  addLabel?: string;
};

export function TodayTasks({
  date,
  todos,
  onChange,
  onError,
  title = "Tasks",
  hint,
  allowAdd = true,
  addHref,
  addLabel = "Add in Tasks",
}: Props) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const done = todos.filter((t) => t.done).length;

  async function addTask() {
    const text = draft.trim();
    if (!text || busy) return;
    const tempId = `tmp-${Date.now()}`;
    const optimistic: TodayTodo = { id: tempId, text, done: false };
    onChange((prev) => [...prev, optimistic]);
    setDraft("");
    setBusy(true);
    try {
      const res = await fetch("/api/day-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add-todo", text, date }),
      });
      if (!res.ok) {
        onChange((prev) => prev.filter((t) => t.id !== tempId));
        setDraft(text);
        onError?.("Couldn’t add that task.");
        return;
      }
      const data = await res.json();
      if (data.todo) {
        onChange((prev) =>
          prev.map((t) => (t.id === tempId ? (data.todo as TodayTodo) : t))
        );
      }
    } catch {
      onChange((prev) => prev.filter((t) => t.id !== tempId));
      setDraft(text);
      onError?.("Couldn’t add that task.");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  async function toggle(t: TodayTodo) {
    onChange((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x))
    );
    if (t.id.startsWith("tmp-")) return;
    const res = await fetch("/api/day-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, done: !t.done }),
    });
    if (!res.ok) {
      onChange((prev) =>
        prev.map((x) => (x.id === t.id ? { ...x, done: t.done } : x))
      );
    }
  }

  async function remove(t: TodayTodo) {
    onChange((prev) => prev.filter((x) => x.id !== t.id));
    if (t.id.startsWith("tmp-")) return;
    const res = await fetch("/api/day-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-todo", id: t.id }),
    });
    if (!res.ok) onChange((prev) => [...prev, t]);
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-medium text-white">{title}</h2>
        <span className="flex items-center gap-3">
          {!allowAdd && addHref ? (
            <Link href={addHref} className="text-xs text-[var(--color-dawn)]">
              {addLabel}
            </Link>
          ) : null}
          <span className="text-xs tabular-nums text-[var(--color-mist)]">
            {todos.length ? `${done}/${todos.length}` : "none yet"}
          </span>
        </span>
      </div>

      {allowAdd ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addTask();
          }}
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a task — then Enter"
            className="ui-field flex-1 !py-3"
            autoComplete="off"
            enterKeyHint="done"
            maxLength={120}
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="ui-btn ui-btn-primary !min-h-12 !px-3.5"
            aria-label="Add task"
          >
            <IconPlus size={18} />
          </button>
        </form>
      ) : null}

      {todos.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-mist)]">
          {hint ||
            (allowAdd
              ? "Type a task and hit Enter. No extra screens."
              : "No tasks for today.")}
        </p>
      ) : (
        <ul className={`${allowAdd ? "mt-3" : ""} space-y-1.5`}>
          {todos.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/20"
            >
              <button
                type="button"
                onClick={() => void toggle(t)}
                className={`flex min-h-12 min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left ${
                  t.done ? "opacity-55" : ""
                }`}
              >
                <span className={`ui-check ${t.done ? "is-on" : ""}`}>✓</span>
                <span
                  className={`min-w-0 flex-1 text-sm leading-snug ${
                    t.done
                      ? "text-[var(--color-mist)] line-through"
                      : "text-white"
                  }`}
                >
                  {t.text}
                </span>
              </button>
              {allowAdd ? (
                <button
                  type="button"
                  onClick={() => void remove(t)}
                  className="mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--color-mist)] hover:text-white"
                  aria-label={`Remove ${t.text}`}
                >
                  <IconX size={14} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
