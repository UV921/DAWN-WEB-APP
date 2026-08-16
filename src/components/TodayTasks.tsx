"use client";

import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import {
  IconChevronDown,
  IconClock,
  IconFlag,
  IconPlus,
  IconShare,
  IconX,
} from "@/components/icons";
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

function flagClass(priority?: string) {
  const p = normalizePriority(priority);
  if (p === "high") return "text-[var(--color-ember)]";
  if (p === "low") return "text-[var(--color-mist)]";
  return "text-[var(--color-dawn)]";
}

function nextPriority(priority?: string): TodoPriority {
  const p = normalizePriority(priority);
  if (p === "high") return "medium";
  if (p === "medium") return "low";
  return "high";
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
  const [flagOpen, setFlagOpen] = useState(false);
  const [remindOpen, setRemindOpen] = useState(false);
  const [remindAt, setRemindAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<{
    name: string;
    text: string;
  } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [timeEditId, setTimeEditId] = useState<string | null>(null);
  const [subDraft, setSubDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const subRef = useRef<HTMLInputElement>(null);
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

  function openTask(id: string) {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    setSubDraft("");
    setTimeEditId(null);
    if (next) {
      window.setTimeout(() => subRef.current?.focus(), 40);
    }
  }

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
    setFlagOpen(false);
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
    if (timeEditId === t.id) setTimeEditId(null);
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
      onError?.("Max 8 steps on a task.");
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
        onError?.("Couldn’t add that step.");
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
      onError?.("Couldn’t add that step.");
    } finally {
      setBusy(false);
      subRef.current?.focus();
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

  function renderSub(t: TodayTodo) {
    return (
      <li key={t.id} className="flex items-center">
        <button
          type="button"
          onClick={() => void toggle(t)}
          className={`flex min-h-10 min-w-0 flex-1 items-center gap-2.5 py-1.5 text-left ${
            t.done ? "opacity-50" : ""
          }`}
        >
          <span className={`ui-check ${t.done ? "is-on" : ""}`}>✓</span>
          <span
            className={`min-w-0 flex-1 text-[13px] leading-snug ${
              t.done ? "text-[var(--color-mist)] line-through" : "text-[#d6e2ec]"
            }`}
          >
            {t.text}
          </span>
        </button>
        {allowAdd ? (
          <button
            type="button"
            onClick={() => void remove(t)}
            className="flex h-9 w-9 shrink-0 items-center justify-center text-[var(--color-mist)] hover:text-white"
            aria-label={`Remove ${t.text}`}
          >
            <IconX size={13} />
          </button>
        ) : null}
      </li>
    );
  }

  function renderRow(t: TodayTodo, kids: TodayTodo[]) {
    const childDone = kids.filter((k) => k.done).length;
    const expanded = expandedId === t.id;
    const editingTime = timeEditId === t.id;
    return (
      <li key={t.id} className="border-b border-white/[0.06] last:border-0">
        <div className="flex items-center gap-0.5 px-1.5">
          <button
            type="button"
            onClick={() => void toggle(t)}
            className={`flex h-12 w-10 shrink-0 items-center justify-center ${
              t.done ? "opacity-50" : ""
            }`}
            aria-label={t.done ? `Undo ${t.text}` : `Complete ${t.text}`}
          >
            <span className={`ui-check ${t.done ? "is-on" : ""}`}>✓</span>
          </button>
          {allowAdd ? (
            <button
              type="button"
              onClick={() => void patchTodo(t, { priority: nextPriority(t.priority) })}
              className={`flex h-10 w-8 shrink-0 items-center justify-center ${flagClass(t.priority)}`}
              aria-label={`Priority ${normalizePriority(t.priority)}. Tap to change.`}
              title={`Priority: ${normalizePriority(t.priority)}`}
            >
              <IconFlag size={15} />
            </button>
          ) : (
            <span
              className={`flex h-10 w-8 shrink-0 items-center justify-center ${flagClass(t.priority)}`}
              aria-hidden
            >
              <IconFlag size={15} />
            </span>
          )}
          <button
            type="button"
            onClick={() => openTask(t.id)}
            className={`flex min-h-12 min-w-0 flex-1 items-center gap-2 py-2 text-left ${
              t.done ? "opacity-50" : ""
            }`}
          >
            <span
              className={`min-w-0 flex-1 text-sm leading-snug ${
                t.done
                  ? "text-[var(--color-mist)] line-through"
                  : "text-white"
              }`}
            >
              {t.text}
            </span>
            {kids.length > 0 ? (
              <span className="shrink-0 text-[11px] tabular-nums text-[var(--color-mist)]">
                {childDone}/{kids.length}
              </span>
            ) : null}
            <IconChevronDown
              size={14}
              className={`shrink-0 text-[var(--color-mist)] transition ${
                expanded ? "rotate-180 text-white" : ""
              }`}
            />
          </button>
          {allowAdd ? (
            <button
              type="button"
              onClick={() =>
                setTimeEditId(editingTime ? null : t.id)
              }
              className={`mr-0.5 flex h-10 min-w-10 shrink-0 items-center justify-center gap-1 px-1 ${
                t.remindAt
                  ? "text-[var(--color-dawn)]"
                  : "text-[var(--color-mist)] hover:text-white"
              }`}
              aria-label={
                t.remindAt
                  ? `Reminder ${t.remindAt}. Tap to change.`
                  : "Set a reminder time"
              }
            >
              <IconClock size={15} />
              {t.remindAt ? (
                <span className="text-[11px] tabular-nums">{t.remindAt}</span>
              ) : null}
            </button>
          ) : t.remindAt ? (
            <span className="mr-1 flex items-center gap-1 text-[11px] tabular-nums text-[var(--color-mist)]">
              <IconClock size={13} />
              {t.remindAt}
            </span>
          ) : null}
          {allowAdd ? (
            <button
              type="button"
              onClick={() => void remove(t)}
              className="mr-1 flex h-10 w-9 shrink-0 items-center justify-center text-[var(--color-mist)] hover:text-white"
              aria-label={`Remove ${t.text}`}
            >
              <IconX size={14} />
            </button>
          ) : null}
        </div>

        {editingTime ? (
          <div className="flex items-center gap-2 px-4 pb-2 pl-20">
            <IconClock size={14} className="text-[var(--color-dawn)]" />
            <input
              type="time"
              value={t.remindAt || ""}
              onChange={(e) =>
                void patchTodo(t, { remindAt: parseRemindAt(e.target.value) })
              }
              className="ui-field !inline-flex !w-auto !py-1.5"
            />
            {t.remindAt ? (
              <button
                type="button"
                onClick={() => {
                  void patchTodo(t, { remindAt: null });
                  setTimeEditId(null);
                }}
                className="text-[11px] text-[var(--color-mist)] hover:text-white"
              >
                Clear
              </button>
            ) : null}
          </div>
        ) : null}

        {expanded ? (
          <div className="mb-2 ml-[2.85rem] mr-3 border-l border-[var(--color-dawn)]/35 pl-3">
            <p className="pt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--color-mist)]">
              Steps
            </p>
            {kids.length > 0 ? (
              <ul className="mt-0.5">{kids.map((k) => renderSub(k))}</ul>
            ) : (
              <p className="py-1.5 text-[13px] text-[var(--color-mist)]">
                No steps yet. Break this task down.
              </p>
            )}
            {allowAdd ? (
              kids.length < 8 ? (
                <form
                  className="flex gap-2 pb-2 pt-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void addSubtask(t);
                  }}
                >
                  <input
                    ref={expanded ? subRef : undefined}
                    value={subDraft}
                    onChange={(e) => setSubDraft(e.target.value)}
                    placeholder="Add a step"
                    className="ui-field flex-1 !py-2"
                    autoComplete="off"
                    maxLength={120}
                  />
                  <button
                    type="submit"
                    disabled={busy || !subDraft.trim()}
                    className="ui-btn ui-btn-primary !min-h-10 !px-3"
                    aria-label="Add step"
                  >
                    <IconPlus size={16} />
                  </button>
                </form>
              ) : (
                <p className="pb-2 text-[11px] text-[var(--color-mist)]">
                  Max 8 steps.
                </p>
              )
            ) : null}
          </div>
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
                type="button"
                onClick={() => {
                  setFlagOpen((v) => !v);
                  setRemindOpen(false);
                }}
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
                  flagOpen
                    ? "border-[var(--color-dawn)]/50 bg-white/5"
                    : "border-white/12"
                } ${flagClass(priority)}`}
                aria-label={`Priority ${priority}. Tap to choose.`}
                title={`Priority: ${priority}`}
              >
                <IconFlag size={18} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setRemindOpen((v) => !v);
                  setFlagOpen(false);
                }}
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
                  remindOpen || remindAt
                    ? "border-[var(--color-dawn)]/50 bg-white/5 text-[var(--color-dawn)]"
                    : "border-white/12 text-[var(--color-mist)]"
                }`}
                aria-label={
                  remindAt
                    ? `Remind at ${remindAt}`
                    : "Set a reminder time"
                }
                title={remindAt ? `Remind at ${remindAt}` : "Reminder time"}
              >
                <IconClock size={18} />
              </button>
              <button
                type="submit"
                disabled={busy || !draft.trim()}
                className="ui-btn ui-btn-primary !min-h-12 !px-3.5"
                aria-label="Add item"
              >
                <IconPlus size={18} />
              </button>
            </div>

            {flagOpen ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] text-[var(--color-mist)]">
                  Priority
                </span>
                {PRIORITY_CHIPS.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => {
                      setPriority(chip.key);
                      setFlagOpen(false);
                    }}
                    className={`${chipClass(priority === chip.key)} inline-flex items-center gap-1.5`}
                  >
                    <IconFlag size={13} className={flagClass(chip.key)} />
                    {chip.label}
                  </button>
                ))}
              </div>
            ) : null}
            {remindOpen ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-[var(--color-mist)]">
                  Remind at
                </span>
                <input
                  type="time"
                  value={remindAt}
                  onChange={(e) => setRemindAt(e.target.value)}
                  className="ui-field !inline-flex !w-auto !py-2"
                />
                {remindAt ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRemindAt("");
                      setRemindOpen(false);
                    }}
                    className="text-[11px] text-[var(--color-mist)] hover:text-white"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            ) : null}
            <p className="text-[11px] text-[var(--color-mist)]">
              Flag is priority. Clock is a reminder. Tap a task to add steps.
            </p>
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
                  ? "Pick a list, type the task, flag it if it matters, then tap it to add steps."
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
                  <ul>{roots.map((t) => renderRow(t, kids.get(t.id) || []))}</ul>
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
