"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconCheck,
  IconClock,
  IconDiscord,
  IconPlus,
} from "@/components/icons";
import { UiMessage } from "@/components/UiMessage";
import {
  blobToBase64Png,
  downloadPngBlob,
  renderTodoListCardPng,
} from "@/lib/share-todo-card";

type Step = "reminders" | "todos";

type Props = {
  open: boolean;
  date: string;
  initialStep?: Step;
  /** Called once the flow is finished or skipped, so the parent can refresh. */
  onDone: () => void;
};

type Draft = { id: string; text: string; time?: string };

/**
 * The two things worth doing the moment you wake: set reminders, then list the
 * day's tasks. Runs inline on Today so nothing forces a page change.
 */
export function MorningAfterWake({
  open,
  date,
  initialStep = "reminders",
  onDone,
}: Props) {
  const [step, setStep] = useState<Step>(initialStep);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{
    tone: "success" | "error" | "tip";
    text: string;
  } | null>(null);

  const [remText, setRemText] = useState("");
  const [remTime, setRemTime] = useState("");
  const [reminders, setReminders] = useState<Draft[]>([]);

  const [taskText, setTaskText] = useState("");
  const [tasks, setTasks] = useState<Draft[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setStep(initialStep);
  }, [open, initialStep]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, step]);

  if (!open) return null;

  async function setFlow(next: Step | "done") {
    await fetch("/api/mission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "morning-flow", step: next }),
    });
  }

  async function addReminder() {
    const text = remText.trim();
    if (!text || !/^\d{2}:\d{2}$/.test(remTime)) {
      setMsg({ tone: "tip", text: "Needs a name and a time." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: text,
        time: remTime,
        message: "",
        notifyBrowser: true,
        notifyDiscord: false,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg({ tone: "error", text: "Couldn’t save that reminder." });
      return;
    }
    const saved = await res.json().catch(() => ({}));
    setReminders((prev) => [
      ...prev,
      { id: saved?.reminder?.id || `${Date.now()}`, text, time: remTime },
    ]);
    setRemText("");
    setRemTime("");
    inputRef.current?.focus();
  }

  async function addTask() {
    const text = taskText.trim();
    if (!text) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/day-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add-todo", text, date }),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg({ tone: "error", text: "Couldn’t add that task." });
      return;
    }
    const saved = await res.json().catch(() => ({}));
    setTasks((prev) => [
      ...prev,
      { id: saved?.todo?.id || `${Date.now()}`, text },
    ]);
    setTaskText("");
    inputRef.current?.focus();
  }

  async function goTodos() {
    setBusy(true);
    await setFlow("todos");
    setBusy(false);
    setStep("todos");
    setMsg(null);
  }

  async function finish(sendToDiscord: boolean) {
    setBusy(true);
    if (sendToDiscord && tasks.length) {
      let image: string | undefined;
      try {
        const { blob, filename } = await renderTodoListCardPng({
          listTitle: "Today",
          date,
          items: tasks.map((t) => ({ text: t.text, done: false })),
        });
        try {
          downloadPngBlob(blob, filename);
        } catch {
          /* iOS may block download */
        }
        const b64 = await blobToBase64Png(blob);
        if (b64.length > 0 && b64.length < 1_200_000) image = b64;
      } catch {
        /* post text list anyway */
      }
      try {
        const res = await fetch("/api/discord/send-todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, image }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setBusy(false);
          setMsg({
            tone: "error",
            text: err.error || "Couldn’t post to Discord.",
          });
          return;
        }
      } catch {
        setBusy(false);
        setMsg({
          tone: "error",
          text: "Couldn’t reach Dawn to post. Your tasks are still saved — try Send from Today.",
        });
        await setFlow("done");
        onDone();
        return;
      }
    }
    await setFlow("done");
    setBusy(false);
    onDone();
  }

  const onReminders = step === "reminders";
  const drafts = onReminders ? reminders : tasks;

  return (
    <section className="rounded-3xl border border-[var(--color-dawn)]/25 bg-[var(--color-dawn)]/[0.05] p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-dawn)]">
            Step {onReminders ? 1 : 2} of 2
          </p>
          <h2 className="font-display mt-1 text-xl text-white">
            {onReminders ? "Anything to remind you about?" : "What are you doing today?"}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-mist)]">
            {onReminders
              ? "Set the times now and Dawn will nudge you."
              : "List the tasks. You can tick them off right here later."}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void finish(false)}
          className="shrink-0 text-[13px] text-[var(--color-mist)] hover:text-white disabled:opacity-50"
        >
          Skip
        </button>
      </div>

      <div className="mt-4 flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] py-1 pl-3 pr-1.5">
        <input
          ref={inputRef}
          value={onReminders ? remText : taskText}
          onChange={(e) =>
            onReminders ? setRemText(e.target.value) : setTaskText(e.target.value)
          }
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            void (onReminders ? addReminder() : addTask());
          }}
          placeholder={onReminders ? "Remind me to…" : "Task for today"}
          maxLength={120}
          autoComplete="off"
          className="min-w-0 flex-1 border-0 bg-transparent py-2 text-[15px] text-white outline-none placeholder:text-[var(--color-mist)]"
        />
        {onReminders ? (
          <label className="flex shrink-0 items-center gap-1 rounded-xl px-2 py-1.5 text-[13px] text-[var(--color-mist)]">
            <IconClock size={13} />
            <input
              type="time"
              value={remTime}
              onChange={(e) => setRemTime(e.target.value)}
              className="border-0 bg-transparent text-[13px] text-white outline-none"
              aria-label="Reminder time"
            />
          </label>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void (onReminders ? addReminder() : addTask())}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--color-dawn)] text-[var(--color-night)] disabled:opacity-40"
          aria-label={onReminders ? "Add reminder" : "Add task"}
        >
          <IconPlus size={16} />
        </button>
      </div>

      {drafts.length ? (
        <ul className="mt-3 space-y-1">
          {drafts.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-2 text-sm text-[var(--color-cloud)]"
            >
              <IconCheck size={13} className="text-[var(--color-leaf)]" />
              <span className="min-w-0 flex-1 truncate">{d.text}</span>
              {d.time ? (
                <span className="shrink-0 tabular-nums text-xs text-[var(--color-mist)]">
                  {d.time}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {msg ? (
        <div className="mt-3">
          <UiMessage tone={msg.tone}>{msg.text}</UiMessage>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {onReminders ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void goTodos()}
            className="ui-btn ui-btn-primary flex-1"
          >
            Next · tasks
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void finish(false)}
              className="ui-btn ui-btn-primary flex-1"
            >
              Start the day
            </button>
            {tasks.length ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void finish(true)}
                className="ui-btn ui-btn-ghost"
                title="Post this list in your Discord channel"
              >
                <IconDiscord size={14} />
                Send
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
