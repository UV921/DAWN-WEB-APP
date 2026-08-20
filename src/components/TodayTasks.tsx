"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconDiscord,
  IconDownload,
  IconFlag,
  IconPlus,
  IconShare,
  IconX,
} from "@/components/icons";
import {
  downloadPngBlob,
  fileForDiscordCard,
  renderTodoListCardPng,
  shareTodoListCard,
} from "@/lib/share-todo-card";
import { parseBotMessages, TODOS_SEND_MODE_OPTIONS, type TodosSendMode } from "@/lib/bot-messages";
import { postTodosFromBrowser } from "@/lib/post-todos-client";
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
  const [sendingDiscord, setSendingDiscord] = useState(false);
  const [discordNote, setDiscordNote] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [pingText, setPingText] = useState("");
  const [sendTime, setSendTime] = useState("");
  const [sendMode, setSendMode] = useState<TodosSendMode>("manual");
  const [savingTime, setSavingTime] = useState(false);
  const [listMenu, setListMenu] = useState(false);
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

  const loadSendPrefs = useCallback(async () => {
    const res = await fetch("/api/settings");
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    const bot = parseBotMessages(data?.botMessages);
    setPingText(bot.todosPingText);
    setSendTime(bot.todosSendTime);
    setSendMode(bot.todosSendMode);
  }, []);

  useEffect(() => {
    void loadSendPrefs();
  }, [loadSendPrefs]);

  async function openSendPanel() {
    setSendOpen((open) => !open);
    setDiscordNote(null);
    if (!sendOpen) void loadSendPrefs();
  }

  async function pngForTodos() {
    return renderTodoListCardPng({
      listTitle: title,
      date,
      items: todos.filter((t) => !t.parentId).map((t) => ({
        text: t.text,
        done: t.done,
      })),
    });
  }

  async function downloadTasksPng() {
    try {
      const { blob, filename } = await pngForTodos();
      await downloadPngBlob(blob, filename);
      setDiscordNote("PNG saved.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      onError?.("Couldn’t make the PNG.");
    }
  }

  async function saveSendPrefs(next: {
    pingText?: string;
    sendTime?: string;
    sendMode?: TodosSendMode;
  }) {
    setSavingTime(true);
    setDiscordNote(null);
    const nextPing = next.pingText ?? pingText;
    const nextTime = next.sendTime ?? sendTime;
    const nextMode = next.sendMode ?? sendMode;
    try {
      const res = await fetch("/api/settings");
      const data = await res.json().catch(() => null);
      const bot = parseBotMessages(data?.botMessages);
      const save = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botMessages: {
            ...bot,
            todosPingText: nextPing,
            todosSendTime: nextTime,
            todosSendMode: nextMode,
          },
        }),
      });
      if (!save.ok) {
        onError?.("Couldn’t save Discord send settings.");
        return;
      }
      if (nextMode === "off") {
        setDiscordNote("Task messages are off — Dawn will not post this list.");
      } else if (nextMode === "date") {
        setDiscordNote(
          nextTime
            ? `Date-wise ping saved for ${nextTime}. Dawn posts that day’s list and @’s you.`
            : "Date-wise is on — pick a send time so Dawn can auto-post."
        );
      } else {
        setDiscordNote("Manual only — tap Send now when you want the list in Discord.");
      }
    } catch {
      onError?.("Couldn’t save Discord send settings.");
    } finally {
      setSavingTime(false);
    }
  }

  async function saveSendTime() {
    await saveSendPrefs({ pingText, sendTime, sendMode: "date" });
  }

  async function setTodosSendMode(mode: TodosSendMode) {
    setSendMode(mode);
    if (mode === "date") setSendOpen(true);
    await saveSendPrefs({ sendMode: mode });
  }

  async function sendToDiscord() {
    if (sendingDiscord || !todos.length) return;
    if (sendMode === "off") {
      onError?.(
        "Task messages are off. Switch to Manual or Date-wise first."
      );
      return;
    }
    setSendingDiscord(true);
    setDiscordNote(null);
    let image: File | undefined;
    try {
      const { blob } = await pngForTodos();
      image = await fileForDiscordCard(blob);
    } catch {
      /* Text list still posts if the card can’t be drawn. */
    }
    try {
      const result = await postTodosFromBrowser({
        date,
        message: pingText,
        image,
      });
      if (!result.ok) {
        onError?.(result.error || "Couldn’t post to Discord.");
      } else {
        setDiscordNote(
          result.usedImage
            ? "Posted the card in your Discord channel."
            : "Posted the text list in Discord (image didn’t attach)."
        );
      }
    } finally {
      setSendingDiscord(false);
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
      <li key={t.id} className="group/sub flex items-center gap-1">
        <button
          type="button"
          onClick={() => void toggle(t)}
          className={`flex min-h-9 min-w-0 flex-1 items-center gap-2.5 py-1 text-left ${
            t.done ? "opacity-45" : ""
          }`}
        >
          <span className={`ui-check !h-4 !w-4 ${t.done ? "is-on" : ""}`}>
            ✓
          </span>
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
            className="flex h-8 w-8 shrink-0 items-center justify-center text-[var(--color-mist)] opacity-70 hover:text-white md:opacity-0 md:group-hover/sub:opacity-100"
            aria-label={`Remove ${t.text}`}
          >
            <IconX size={12} />
          </button>
        ) : null}
      </li>
    );
  }

  function renderRow(t: TodayTodo, kids: TodayTodo[]) {
    const childDone = kids.filter((k) => k.done).length;
    const expanded = expandedId === t.id;
    const editingTime = timeEditId === t.id;
    const pri = normalizePriority(t.priority);
    return (
      <li
        key={t.id}
        className={`group border-b border-white/[0.06] last:border-0 ${
          expanded ? "bg-white/[0.025]" : ""
        }`}
      >
        <div className="flex items-center gap-1 px-3">
          <span
            className={`h-8 w-0.5 shrink-0 rounded-full ${
              pri === "high"
                ? "bg-[var(--color-ember)]"
                : pri === "low"
                  ? "bg-transparent"
                  : "bg-[var(--color-dawn)]/55"
            }`}
            aria-hidden
          />
          <button
            type="button"
            onClick={() => void toggle(t)}
            className={`flex h-12 w-11 shrink-0 items-center justify-center ${
              t.done ? "opacity-45" : ""
            }`}
            aria-label={t.done ? `Undo ${t.text}` : `Complete ${t.text}`}
          >
            <span className={`ui-check ${t.done ? "is-on" : ""}`}>✓</span>
          </button>
          <button
            type="button"
            onClick={() => openTask(t.id)}
            className={`flex min-h-12 min-w-0 flex-1 items-center gap-2 py-2 text-left ${
              t.done ? "opacity-45" : ""
            }`}
          >
            <span
              className={`min-w-0 flex-1 text-[15px] leading-snug ${
                t.done ? "text-[var(--color-mist)] line-through" : "text-white"
              }`}
            >
              {t.text}
            </span>
            {t.remindAt ? (
              <span className="hidden shrink-0 items-center gap-1 text-[11px] tabular-nums text-[var(--color-mist)] sm:inline-flex">
                <IconClock size={12} />
                {t.remindAt}
              </span>
            ) : null}
            {kids.length > 0 ? (
              <span className="shrink-0 text-[11px] tabular-nums text-[var(--color-mist)]">
                {childDone}/{kids.length}
              </span>
            ) : null}
            <IconChevronDown
              size={14}
              className={`shrink-0 text-[var(--color-mist)]/50 transition ${
                expanded ? "rotate-180 text-white/80" : ""
              }`}
            />
          </button>
          {allowAdd ? (
            <button
              type="button"
              onClick={() => void remove(t)}
              className="flex h-11 w-10 shrink-0 items-center justify-center text-[var(--color-mist)] opacity-0 hover:text-white group-hover:opacity-100 max-md:opacity-70"
              aria-label={`Remove ${t.text}`}
            >
              <IconX size={13} />
            </button>
          ) : null}
        </div>

        {expanded ? (
            <div className="border-t border-white/[0.05] pb-3 pl-[3.3rem] pr-3 pt-2">
            {kids.length > 0 ? (
              <ul>{kids.map((k) => renderSub(k))}</ul>
            ) : (
              <p className="py-1 text-[13px] text-[var(--color-mist)]">
                Break this into steps.
              </p>
            )}
            {allowAdd ? (
              kids.length < 8 ? (
                <form
                  className="mt-1 flex items-center gap-2"
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
                    className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-[13px] text-white outline-none placeholder:text-[var(--color-mist)]"
                    autoComplete="off"
                    maxLength={120}
                  />
                  <button
                    type="submit"
                    disabled={busy || !subDraft.trim()}
                    className="text-[12px] font-medium text-[var(--color-dawn)] disabled:opacity-40"
                  >
                    Add
                  </button>
                </form>
              ) : (
                <p className="text-[11px] text-[var(--color-mist)]">Max 8 steps.</p>
              )
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
              {allowAdd ? (
                <button
                  type="button"
                  onClick={() =>
                    void patchTodo(t, { priority: nextPriority(t.priority) })
                  }
                  className={`inline-flex items-center gap-1.5 ${flagClass(t.priority)}`}
                >
                  <IconFlag size={12} />
                  {pri}
                </button>
              ) : (
                <span className={`inline-flex items-center gap-1.5 ${flagClass(t.priority)}`}>
                  <IconFlag size={12} />
                  {pri}
                </span>
              )}
              {allowAdd ? (
                <button
                  type="button"
                  onClick={() => setTimeEditId(editingTime ? null : t.id)}
                  className={`inline-flex items-center gap-1.5 ${
                    t.remindAt
                      ? "text-[var(--color-dawn)]"
                      : "text-[var(--color-mist)] hover:text-white"
                  }`}
                >
                  <IconClock size={12} />
                  {t.remindAt || "Time"}
                </button>
              ) : t.remindAt ? (
                <span className="inline-flex items-center gap-1.5 tabular-nums text-[var(--color-mist)]">
                  <IconClock size={12} />
                  {t.remindAt}
                </span>
              ) : null}
              <Link
                href={`/tasks/${t.id}`}
                className="inline-flex items-center gap-1 text-[var(--color-mist)] hover:text-white"
              >
                Open
                <IconChevronRight size={11} />
              </Link>
            </div>
            {editingTime ? (
              <div className="mt-2 flex items-center gap-2">
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
          </div>
        ) : null}
      </li>
    );
  }

  const progress = todos.length ? Math.round((done / todos.length) * 100) : 0;
  const remaining = Math.max(0, todos.length - done);

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-medium text-white">{title}</h2>
          <p className="mt-0.5 text-xs text-[var(--color-mist)]">
            {todos.length
              ? remaining
                ? `${remaining} left to do`
                : "All done"
              : "Nothing listed yet"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {todos.length > 0 ? (
            <button
              type="button"
              onClick={() => void openSendPanel()}
              className={`inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium hover:bg-white/[0.06] hover:text-white ${
                sendOpen
                  ? "bg-white/[0.08] text-white"
                  : "text-[var(--color-mist)]"
              }`}
              title="Send this list to Discord, or turn Discord task messages off"
            >
              <IconDiscord size={13} />
              {sendMode === "off" ? "Discord" : "Send"}
            </button>
          ) : null}
          {!allowAdd && addHref && todos.length > 0 ? (
            <Link
              href={addHref}
              className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-[var(--color-dawn)] hover:bg-[var(--color-dawn)]/10"
            >
              <IconPlus size={13} />
              Add
            </Link>
          ) : null}
          {todos.length === 0 ? null : progress >= 100 ? (
            <span
              className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-dawn)] text-[var(--color-night)]"
              aria-label="All tasks done"
              title="All done"
            >
              <IconCheck size={14} strokeWidth={2.4} />
            </span>
          ) : (
            <span className="text-[12px] tabular-nums text-[var(--color-mist)]">
              {done}/{todos.length}
            </span>
          )}
        </div>
      </header>

      {sendOpen && todos.length > 0 ? (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 sm:px-4">
          <p className="text-xs text-[var(--color-mist)]">
            Off never posts. Manual is Send now only. Date-wise posts this
            date’s list at a time you pick.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TODOS_SEND_MODE_OPTIONS.map((mode) => (
              <button
                key={mode.value}
                type="button"
                disabled={savingTime}
                onClick={() => void setTodosSendMode(mode.value)}
                className={`rounded-full border px-3 py-1.5 text-[12px] ${
                  sendMode === mode.value
                    ? "border-[var(--color-dawn)] bg-[var(--color-dawn)]/15 text-[var(--color-dawn)]"
                    : "border-white/20 text-white"
                } disabled:opacity-50`}
              >
                {mode.label}
              </button>
            ))}
          </div>
          {sendMode === "off" ? (
            <p className="text-xs text-[var(--color-mist)]">
              Discord will not get this list until you switch to Manual or
              Date-wise.
            </p>
          ) : (
            <>
              <textarea
                value={pingText}
                onChange={(e) => setPingText(e.target.value)}
                rows={2}
                maxLength={300}
                placeholder="Ping message — Hey, here's today's work"
                className="ui-field text-sm"
              />
              {sendMode === "date" ? (
                <label className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-mist)]">
                  <IconClock size={13} />
                  Send time
                  <input
                    type="time"
                    value={sendTime}
                    onChange={(e) => setSendTime(e.target.value)}
                    className="ui-field !inline-flex !w-auto !py-1.5"
                  />
                  <button
                    type="button"
                    disabled={savingTime}
                    onClick={() => void saveSendTime()}
                    className="rounded-full px-2.5 py-1 text-[12px] font-medium text-[var(--color-dawn)] hover:bg-[var(--color-dawn)]/10 disabled:opacity-50"
                  >
                    {savingTime ? "Saving…" : sendTime ? "Save time" : "Need a time"}
                  </button>
                </label>
              ) : null}
            </>
          )}
          <div className="flex flex-wrap gap-2">
            {sendMode !== "off" ? (
              <button
                type="button"
                disabled={sendingDiscord}
                onClick={() => void sendToDiscord()}
                className="ui-btn ui-btn-primary !h-9 !px-4 text-[12px]"
              >
                <IconDiscord size={13} />
                {sendingDiscord ? "Sending…" : "Send now"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void downloadTasksPng()}
              className="ui-btn ui-btn-ghost !h-9 !px-4 text-[12px]"
            >
              <IconDownload size={13} />
              Download PNG
            </button>
          </div>
        </div>
      ) : null}

      {discordNote ? (
        <p className="text-xs text-[var(--color-leaf)]">{discordNote}</p>
      ) : null}

      {allowAdd ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addTask();
          }}
        >
          <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.03] py-1 pl-2 pr-1.5">
            <button
              type="button"
              onClick={() => {
                setListMenu((v) => !v);
                setFlagOpen(false);
                setRemindOpen(false);
              }}
              className="inline-flex h-10 max-w-[7.5rem] shrink-0 items-center gap-1 rounded-xl px-2 text-[12px] text-[var(--color-mist)] hover:bg-white/6 hover:text-white"
              aria-label="Choose list"
            >
              <span className="truncate">{normalizeListTitle(listTitle)}</span>
              <IconChevronDown
                size={12}
                className={`shrink-0 transition ${listMenu ? "rotate-180" : ""}`}
              />
            </button>
            <span className="h-4 w-px shrink-0 bg-white/10" aria-hidden />
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a task"
              className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-[var(--color-mist)]"
              autoComplete="off"
              enterKeyHint="done"
              maxLength={120}
            />
            <button
              type="button"
              onClick={() => {
                setFlagOpen((v) => !v);
                setRemindOpen(false);
                setListMenu(false);
              }}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${flagClass(priority)} ${
                flagOpen ? "bg-white/8" : "hover:bg-white/6"
              }`}
              aria-label={`Priority ${priority}`}
              title={`Priority: ${priority}`}
            >
              <IconFlag size={15} />
            </button>
            <button
              type="button"
              onClick={() => {
                setRemindOpen((v) => !v);
                setFlagOpen(false);
                setListMenu(false);
              }}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                remindOpen || remindAt
                  ? "bg-white/8 text-[var(--color-dawn)]"
                  : "text-[var(--color-mist)] hover:bg-white/6 hover:text-white"
              }`}
              aria-label={remindAt ? `Remind at ${remindAt}` : "Reminder"}
            >
              <IconClock size={15} />
            </button>
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-dawn)] text-[var(--color-night)] disabled:opacity-35"
              aria-label="Add item"
            >
              <IconPlus size={16} />
            </button>
          </div>

          {listMenu ? (
            <div className="flex flex-wrap gap-1 px-0.5">
              {LIST_PRESETS.map((preset) => {
                const on = !customOpen && listTitle === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setCustomOpen(false);
                      setListTitle(preset);
                      setListMenu(false);
                      inputRef.current?.focus();
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
          ) : null}
          {customOpen ? (
            <input
              value={listTitle}
              onChange={(e) => setListTitle(e.target.value)}
              placeholder="List name"
              className="ui-field w-full !py-2.5"
              autoComplete="off"
              maxLength={40}
            />
          ) : null}
          {flagOpen ? (
            <div className="flex flex-wrap items-center gap-1.5 px-0.5">
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
                  <IconFlag size={12} className={flagClass(chip.key)} />
                  {chip.label}
                </button>
              ))}
            </div>
          ) : null}
          {remindOpen ? (
            <div className="flex flex-wrap items-center gap-2 px-0.5">
              <input
                type="time"
                value={remindAt}
                onChange={(e) => setRemindAt(e.target.value)}
                className="ui-field !inline-flex !w-auto !py-1.5"
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
        </form>
      ) : null}

      {todos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/12 px-5 py-9 text-center">
          <p className="text-[15px] font-medium text-white">
            {allowAdd ? "Nothing here yet" : "No tasks for today"}
          </p>
          <p className="mx-auto mt-1.5 max-w-[28ch] text-sm text-[var(--color-mist)]">
            {hint ||
              (allowAdd
                ? "Type a task, tap +."
                : "Add them in Tasks — they show up here.")}
          </p>
          {!allowAdd && addHref ? (
            <Link
              href={addHref}
              className="ui-btn ui-btn-primary mx-auto mt-5 !min-h-9 !px-4 text-[13px]"
            >
              <IconPlus size={14} />
              {addLabel}
            </Link>
          ) : null}
        </div>
      ) : (
        <div
          className={
            groups.length > 1
              ? "grid gap-6 md:grid-cols-2 md:gap-8"
              : "space-y-6"
          }
        >
          {groups.map(({ name, items, roots, kids }) => {
            const listDone = items.filter((x) => x.done).length;
            return (
              <article key={name} className="min-w-0">
                <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
                  {allowAdd ? (
                    <button
                      type="button"
                      onClick={() => {
                        const isPreset = LIST_PRESETS.includes(
                          name as (typeof LIST_PRESETS)[number]
                        );
                        setCustomOpen(!isPreset);
                        setListTitle(name);
                        setListMenu(false);
                        inputRef.current?.focus();
                      }}
                      className="truncate text-left text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--color-mist)] hover:text-white"
                    >
                      {name}
                    </button>
                  ) : (
                    <p className="truncate text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--color-mist)]">
                      {name}
                    </p>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] tabular-nums text-[var(--color-mist)]">
                      {listDone}/{items.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => void shareList(name, items)}
                      disabled={Boolean(sharing)}
                      className="flex h-7 w-7 items-center justify-center text-[var(--color-mist)] hover:text-white disabled:opacity-50"
                      aria-label={`Share ${name}`}
                    >
                      <IconShare size={13} />
                    </button>
                  </div>
                </div>
                {shareNote?.name === name ? (
                  <p className="mb-1.5 px-0.5 text-[11px] text-[var(--color-mist)]">
                    {shareNote.text}
                  </p>
                ) : null}
                <ul className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                  {roots.map((t) => renderRow(t, kids.get(t.id) || []))}
                </ul>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function chipClass(on: boolean) {
  return `rounded-full px-3.5 py-2 text-[12px] font-medium tracking-wide transition ${
    on
      ? "bg-[var(--color-dawn)] text-[var(--color-night)]"
      : "border border-white/12 text-[var(--color-mist)] hover:border-[var(--color-dawn)]/55 hover:text-[var(--color-dawn)]"
  }`;
}
