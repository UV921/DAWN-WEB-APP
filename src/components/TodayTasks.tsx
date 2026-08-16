"use client";

import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { IconPlus, IconShare, IconX } from "@/components/icons";
import { shareTodoListCard } from "@/lib/share-todo-card";
import { LIST_PRESETS, normalizeListTitle } from "@/lib/todo-lists";
import {
  normalizePriority,
  parseRemindAt,
  priorityRank,
  type TodoPriority,
} from "@/lib/todo-weight";

export type TodayTodo = {
  id: string;
  text: string;
  done: boolean;
  title?: string;
  priority?: string;
  parentId?: string | null;
  remindAt?: string | null;
  reminderId?: string | null;
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

const PRIORITY_CHIPS: { key: TodoPriority; label: string }[] = [
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

function listName(t: TodayTodo) {
  return normalizeListTitle(t.title);
}

function pipClass(priority?: string) {
  const p = normalizePriority(priority);
  if (p === "high") return "bg-[var(--color-ember)]";
  if (p === "low") return "bg-[var(--color-mist)]";
  return "bg-[var(--color-dawn)]";
}

function sortGroup(items: TodayTodo[]) {
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const pr = priorityRank(a.priority) - priorityRank(b.priority);
    if (pr !== 0) return pr;
    return 0;
  });
}

function nestList(items: TodayTodo[]) {
  const ids = new Set(items.map((t) => t.id));
  const kids = new Map<string, TodayTodo[]>();
  const roots: TodayTodo[] = [];
  for (const t of items) {
    if (t.parentId && ids.has(t.parentId)) {
      const arr = kids.get(t.parentId) || [];
      arr.push(t);
      kids.set(t.parentId, arr);
    } else {
      roots.push(t);
    }
  }
  for (const [id, arr] of kids) {
    kids.set(id, sortGroup(arr));
  }
  return { roots: sortGroup(roots), kids };
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
  const [priority, setPriority] = useState<TodoPriority>("medium");
  const [remindOpen, setRemindOpen] = useState(false);
  const [remindAt, setRemindAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<{
    name: string;
    text: string;
  } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [subDraft, setSubDraft] = useState("");
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
    return [...map.entries()].map(([name, items]) => {
      const nested = nestList(items);
      return { name, items, ...nested };
    });
  }, [todos]);

  async function addTask() {
    const text = draft.trim();
    if (!text || busy) return;
    const titleForItem = normalizeListTitle(listTitle);
    const time = remindOpen ? parseRemindAt(remindAt) : null;
    const tempId = `tmp-${Date.now()}`;
    const optimistic: TodayTodo = {
      id: tempId,
      text,
      done: false,
      title: titleForItem,
      priority,
      parentId: null,
      remindAt: time,
      reminderId: null,
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
          priority,
          remindAt: time,
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
    onChange((prev) =>
      prev.filter((x) => x.id !== t.id && x.parentId !== t.id)
    );
    if (expandedId === t.id) setExpandedId(null);
    if (t.id.startsWith("tmp-")) return;
    const res = await fetch("/api/day-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-todo", id: t.id }),
    });
    if (!res.ok) {
      onChange((prev) => {
        const kids = todos.filter((x) => x.parentId === t.id);
        return [...prev, t, ...kids.filter((k) => !prev.some((p) => p.id === k.id))];
      });
      onError?.("Couldn’t delete that task.");
    }
  }

  async function patchTodo(
    t: TodayTodo,
    patch: { priority?: string; remindAt?: string | null; text?: string }
  ) {
    const next = { ...t, ...patch };
    onChange((prev) => prev.map((x) => (x.id === t.id ? next : x)));
    if (t.id.startsWith("tmp-")) return;
    const res = await fetch("/api/day-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update-todo", id: t.id, ...patch }),
    });
    if (!res.ok) {
      onChange((prev) => prev.map((x) => (x.id === t.id ? t : x)));
      onError?.("Couldn’t update that task.");
      return;
    }
    const data = await res.json();
    if (data.todo) {
      onChange((prev) =>
        prev.map((x) => (x.id === t.id ? (data.todo as TodayTodo) : x))
      );
    }
  }

  async function addSubtask(parent: TodayTodo) {
    const text = subDraft.trim();
    if (!text || busy) return;
    const siblings = todos.filter((x) => x.parentId === parent.id);
    if (siblings.length >= 8) {
      onError?.("Max 8 subtasks.");
      return;
    }
    const tempId = `tmp-${Date.now()}`;
    const optimistic: TodayTodo = {
      id: tempId,
      text,
      done: false,
      title: parent.title,
      priority: "medium",
      parentId: parent.id,
      remindAt: null,
      reminderId: null,
    };
    onChange((prev) => [...prev, optimistic]);
    setSubDraft("");
    setBusy(true);
    try {
      const res = await fetch("/api/day-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-subtask",
          parentId: parent.id,
          text,
        }),
      });
      if (!res.ok) {
        onChange((prev) => prev.filter((x) => x.id !== tempId));
        setSubDraft(text);
        onError?.("Couldn’t add that subtask.");
        return;
      }
      const data = await res.json();
      if (data.todo) {
        onChange((prev) =>
          prev.map((x) => (x.id === tempId ? (data.todo as TodayTodo) : x))
        );
      }
    } catch {
      onChange((prev) => prev.filter((x) => x.id !== tempId));
      setSubDraft(text);
      onError?.("Couldn’t add that subtask.");
    } finally {
      setBusy(false);
    }
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

  function renderRow(t: TodayTodo, kids: TodayTodo[], nested: boolean) {
    const childDone = kids.filter((k) => k.done).length;
    const expanded = allowAdd && expandedId === t.id && !t.parentId;
    return (
      <li key={t.id} className="border-b border-white/[0.06] last:border-0">
        <div className={`flex items-center ${nested ? "pl-6" : ""}`}>
          <button
            type="button"
            onClick={() => void toggle(t)}
            className={`flex min-h-12 min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left ${
              t.done ? "opacity-50" : ""
            }`}
          >
            <span className={`ui-check ${t.done ? "is-on" : ""}`}>✓</span>
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${pipClass(t.priority)}`}
              aria-hidden
            />
            <span
              className={`min-w-0 flex-1 text-sm leading-snug ${
                t.done
                  ? "text-[var(--color-mist)] line-through"
                  : "text-white"
              }`}
            >
              {t.text}
            </span>
            {t.remindAt ? (
              <span className="shrink-0 text-[11px] tabular-nums text-[var(--color-mist)]">
                {t.remindAt}
              </span>
            ) : null}
            {kids.length > 0 ? (
              <span className="shrink-0 text-[11px] tabular-nums text-[var(--color-mist)]">
                {childDone}/{kids.length}
              </span>
            ) : null}
          </button>
          {allowAdd && !t.parentId ? (
            <button
              type="button"
              onClick={() => {
                setExpandedId(expanded ? null : t.id);
                setSubDraft("");
              }}
              className="mr-0.5 flex h-10 w-10 shrink-0 items-center justify-center text-[var(--color-mist)] hover:text-white"
              aria-label={expanded ? "Collapse task" : "Edit task"}
            >
              {expanded ? "–" : "···"}
            </button>
          ) : null}
          {allowAdd ? (
            <button
              type="button"
              onClick={() => void remove(t)}
              className="mr-1 flex h-10 w-10 shrink-0 items-center justify-center text-[var(--color-mist)] hover:text-white"
              aria-label={`Remove ${t.text}`}
            >
              <IconX size={14} />
            </button>
          ) : null}
        </div>
        {expanded ? (
          <div className="space-y-3 border-t border-white/[0.06] bg-black/20 px-3 py-3">
            <div className="flex flex-wrap gap-1.5">
              {PRIORITY_CHIPS.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => void patchTodo(t, { priority: chip.key })}
                  className={chipClass(normalizePriority(t.priority) === chip.key)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-[11px] text-[var(--color-mist)]">
                Time
                <input
                  type="time"
                  value={t.remindAt || ""}
                  onChange={(e) =>
                    void patchTodo(t, {
                      remindAt: parseRemindAt(e.target.value),
                    })
                  }
                  className="ui-field ml-2 !inline-flex !w-auto !py-1.5"
                />
              </label>
              {t.remindAt ? (
                <button
                  type="button"
                  onClick={() => void patchTodo(t, { remindAt: null })}
                  className="text-[11px] text-[var(--color-mist)] hover:text-white"
                >
                  Clear time
                </button>
              ) : null}
            </div>
            {kids.length < 8 ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void addSubtask(t);
                }}
              >
                <input
                  value={expandedId === t.id ? subDraft : ""}
                  onChange={(e) => setSubDraft(e.target.value)}
                  placeholder="Add a subtask"
                  className="ui-field flex-1 !py-2"
                  autoComplete="off"
                  maxLength={120}
                />
                <button
                  type="submit"
                  disabled={busy || !subDraft.trim()}
                  className="ui-btn ui-btn-primary !min-h-10 !px-3"
                  aria-label="Add subtask"
                >
                  <IconPlus size={16} />
                </button>
              </form>
            ) : (
              <p className="text-[11px] text-[var(--color-mist)]">
                Max 8 subtasks.
              </p>
            )}
          </div>
        ) : null}
        {kids.length > 0 ? (
          <ul>
            {kids.map((k) => renderRow(k, [], true))}
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a121a]">
      <header className="flex items-end justify-between gap-3 border-b border-white/[0.08] bg-[linear-gradient(160deg,rgba(240,180,90,0.12),transparent_70%)] px-4 py-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-dawn)]">
            Named lists
          </p>
          <h2 className="font-display mt-1 truncate text-2xl text-white">
            {title}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {!allowAdd && addHref ? (
            <Link
              href={addHref}
              className="text-[11px] font-medium text-[var(--color-dawn)]"
            >
              {addLabel}
            </Link>
          ) : null}
          <span className="font-display text-lg tabular-nums text-[var(--color-dawn)]">
            {todos.length ? `${done}/${todos.length}` : "0"}
          </span>
        </div>
      </header>

      <div className="space-y-4 p-4">
        {allowAdd ? (
          <form
            className="space-y-3"
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
                    className={chipClass(on)}
                  >
                    {preset}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setCustomOpen(true);
                  if (
                    LIST_PRESETS.includes(
                      listTitle as (typeof LIST_PRESETS)[number]
                    )
                  ) {
                    setListTitle("");
                  }
                }}
                className={chipClass(customOpen)}
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
            <div className="flex flex-wrap gap-1.5">
              {PRIORITY_CHIPS.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setPriority(chip.key)}
                  className={chipClass(priority === chip.key)}
                >
                  {chip.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setRemindOpen((v) => !v)}
                className={chipClass(remindOpen)}
              >
                Remind me
              </button>
            </div>
            {remindOpen ? (
              <input
                type="time"
                value={remindAt}
                onChange={(e) => setRemindAt(e.target.value)}
                className="ui-field w-full !py-2.5"
              />
            ) : null}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Add to ${normalizeListTitle(listTitle)}`}
                className="ui-field flex-1 !py-3"
                autoComplete="off"
                enterKeyHint="done"
                maxLength={120}
              />
              <button
                type="submit"
                disabled={busy || !draft.trim()}
                className="ui-btn ui-btn-primary !min-h-12 !px-3.5"
                aria-label="Add item"
              >
                <IconPlus size={18} />
              </button>
            </div>
          </form>
        ) : null}

        {todos.length === 0 ? (
          <div className="border border-dashed border-white/12 px-4 py-8 text-center">
            <p className="font-display text-lg text-[var(--color-dawn)]">
              {allowAdd ? "Start a list" : "Nothing here yet"}
            </p>
            <p className="mx-auto mt-2 max-w-[28ch] text-sm text-[var(--color-mist)]">
              {hint ||
                (allowAdd
                  ? "Pick Buy, Share on X, or Today. Add items. Share a gold PNG."
                  : "Add lists in Tasks — they show up here to check off.")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map(({ name, items, roots, kids }) => {
              const listDone = items.filter((t) => t.done).length;
              return (
                <article
                  key={name}
                  className="overflow-hidden border border-white/10 bg-black/25"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] px-3 py-2.5">
                    <div className="min-w-0">
                      {allowAdd ? (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomOpen(
                              !LIST_PRESETS.includes(
                                name as (typeof LIST_PRESETS)[number]
                              )
                            );
                            setListTitle(name);
                            inputRef.current?.focus();
                          }}
                          className="truncate text-left font-display text-xl text-[var(--color-dawn)]"
                        >
                          {name}
                        </button>
                      ) : (
                        <p className="truncate font-display text-xl text-[var(--color-dawn)]">
                          {name}
                        </p>
                      )}
                      <p className="text-[11px] tabular-nums text-[var(--color-mist)]">
                        {listDone} of {items.length}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void shareList(name, items)}
                      disabled={Boolean(sharing)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-dawn)]/40 bg-[var(--color-dawn)]/12 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-[var(--color-dawn)] disabled:opacity-50"
                    >
                      <IconShare size={13} />
                      {sharing === name ? "Making…" : "Share PNG"}
                    </button>
                  </div>
                  {shareNote?.name === name ? (
                    <p className="border-b border-white/[0.06] px-3 py-2 text-[11px] text-[var(--color-mist)]">
                      {shareNote.text}
                    </p>
                  ) : null}
                  <ul>{roots.map((t) => renderRow(t, kids.get(t.id) || [], false))}</ul>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function chipClass(on: boolean) {
  return `rounded-full px-3 py-1.5 text-[11px] font-medium tracking-wide transition ${
    on
      ? "bg-[var(--color-dawn)] text-[var(--color-night)]"
      : "border border-white/12 text-[var(--color-mist)] hover:border-[var(--color-dawn)]/55 hover:text-[var(--color-dawn)]"
  }`;
}
