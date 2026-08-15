"use client";

import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { IconPlus, IconShare, IconX } from "@/components/icons";
import { shareTodoListCard } from "@/lib/share-todo-card";
import { LIST_PRESETS, normalizeListTitle } from "@/lib/todo-lists";

export type TodayTodo = {
  id: string;
  text: string;
  done: boolean;
  title?: string;
};

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

function listName(t: TodayTodo) {
  return normalizeListTitle(t.title);
}

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
  const [listTitle, setListTitle] = useState("Today");
  const [customOpen, setCustomOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<{
    name: string;
    text: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const done = todos.filter((t) => t.done).length;

  const groups = useMemo(() => {
    const map = new Map<string, TodayTodo[]>();
    for (const t of todos) {
      const key = listName(t);
      const arr = map.get(key) || [];
      arr.push(t);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [todos]);

  async function addTask() {
    const text = draft.trim();
    if (!text || busy) return;
    const titleForItem = normalizeListTitle(listTitle);
    const tempId = `tmp-${Date.now()}`;
    const optimistic: TodayTodo = {
      id: tempId,
      text,
      done: false,
      title: titleForItem,
    };
    onChange((prev) => [...prev, optimistic]);
    setDraft("");
    setBusy(true);
    try {
      const res = await fetch("/api/day-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-todo",
          text,
          date,
          title: titleForItem,
        }),
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

  async function shareList(name: string, items: TodayTodo[]) {
    if (!items.length || sharing) return;
    setSharing(name);
    setShareNote(null);
    try {
      const result = await shareTodoListCard({
        listTitle: name,
        date,
        items: items.map((t) => ({ text: t.text, done: t.done })),
      });
      setShareNote({
        name,
        text:
          result === "shared"
            ? "Opened share — pick X, WhatsApp, or Photos."
            : "Saved a PNG — attach it on X or send it.",
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      onError?.("Couldn’t share that list. Try again.");
    } finally {
      setSharing(null);
    }
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
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addTask();
          }}
        >
          <div className="flex flex-wrap gap-1.5">
            {LIST_PRESETS.map((preset) => {
              const on = !customOpen && listTitle === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setCustomOpen(false);
                    setListTitle(preset);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    on
                      ? "border-[var(--color-dawn)] bg-[var(--color-dawn)]/15 text-[var(--color-dawn)]"
                      : "border-white/12 text-[var(--color-mist)] hover:border-white/25 hover:text-white"
                  }`}
                >
                  {preset}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setCustomOpen(true);
                if (LIST_PRESETS.includes(listTitle as (typeof LIST_PRESETS)[number])) {
                  setListTitle("");
                }
              }}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                customOpen
                  ? "border-[var(--color-dawn)] bg-[var(--color-dawn)]/15 text-[var(--color-dawn)]"
                  : "border-white/12 text-[var(--color-mist)] hover:border-white/25 hover:text-white"
              }`}
            >
              Custom
            </button>
          </div>
          {customOpen ? (
            <input
              value={listTitle}
              onChange={(e) => setListTitle(e.target.value)}
              placeholder="List title — Want to buy, Post on X…"
              className="ui-field w-full !py-2.5"
              autoComplete="off"
              maxLength={40}
            />
          ) : null}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Add to ${normalizeListTitle(listTitle)} — then Enter`}
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
          </div>
        </form>
      ) : null}

      {todos.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-mist)]">
          {hint ||
            (allowAdd
              ? "Pick a list title, type an item, hit Enter. Share a card when you’re ready."
              : "No tasks for today.")}
        </p>
      ) : (
        <div className={`${allowAdd ? "mt-4" : ""} space-y-4`}>
          {groups.map(([name, items]) => {
            const listDone = items.filter((t) => t.done).length;
            return (
              <div key={name}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    {allowAdd ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomOpen(!LIST_PRESETS.includes(name as (typeof LIST_PRESETS)[number]));
                          setListTitle(name);
                          inputRef.current?.focus();
                        }}
                        className="truncate text-left font-display text-lg text-[var(--color-dawn)]"
                      >
                        {name}
                      </button>
                    ) : (
                      <p className="truncate font-display text-lg text-[var(--color-dawn)]">
                        {name}
                      </p>
                    )}
                    <p className="text-[11px] tabular-nums text-[var(--color-mist)]">
                      {listDone}/{items.length}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void shareList(name, items)}
                    disabled={Boolean(sharing)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-dawn)]/35 bg-[var(--color-dawn)]/10 px-3 py-1.5 text-xs font-medium text-[var(--color-dawn)] disabled:opacity-50"
                  >
                    <IconShare size={13} />
                    {sharing === name ? "Making…" : "Share"}
                  </button>
                </div>
                {shareNote?.name === name ? (
                  <p className="mb-2 text-[11px] text-[var(--color-mist)]">
                    {shareNote.text}
                  </p>
                ) : null}
                <ul className="space-y-1.5">
                  {items.map((t) => (
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
                        <span className={`ui-check ${t.done ? "is-on" : ""}`}>
                          ✓
                        </span>
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
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
