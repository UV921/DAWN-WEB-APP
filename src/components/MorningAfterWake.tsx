"use client";

import { useEffect, useState } from "react";
import { IconPlus } from "@/components/icons";
import { UiMessage } from "@/components/UiMessage";

type Props = {
  open: boolean;
  initialStep?: "reminders" | "todos";
  onDone: () => void;
};

/** After wake — short forms, no extra headlines (parent owns the label). */
export function MorningAfterWake({
  open,
  initialStep = "reminders",
  onDone,
}: Props) {
  const [step, setStep] = useState<"reminders" | "todos">(initialStep);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{
    tone: "success" | "error" | "tip";
    text: string;
  } | null>(null);
  const [remTitle, setRemTitle] = useState("");
  const [remTime, setRemTime] = useState("");
  const [todoText, setTodoText] = useState("");
  const [todos, setTodos] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setStep(initialStep);
      setMsg(null);
    }
  }, [open, initialStep]);

  if (!open) return null;

  async function setFlow(next: "reminders" | "todos" | "done") {
    await fetch("/api/mission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "morning-flow", step: next }),
    });
  }

  async function addReminder() {
    if (!remTitle.trim() || !/^\d{2}:\d{2}$/.test(remTime)) {
      setMsg({
        tone: "tip",
        text: "Add a title and a time.",
      });
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: remTitle.trim(),
        time: remTime,
        message: "From your morning check-in",
        notifyBrowser: true,
        notifyDiscord: false,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg({ tone: "error", text: "Couldn’t save reminder." });
      return;
    }
    setRemTitle("");
    setRemTime("");
    setMsg({ tone: "success", text: `Saved for ${remTime}.` });
  }

  async function goTodos() {
    if (remTitle.trim() && /^\d{2}:\d{2}$/.test(remTime)) {
      await addReminder();
    }
    setBusy(true);
    await setFlow("todos");
    await fetch("/api/mission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "seed-today-tasks", todos: [] }),
    });
    setBusy(false);
    setStep("todos");
    setMsg(null);
  }

  async function finishTodos() {
    setBusy(true);
    const extras = [...todos];
    if (todoText.trim()) extras.push(todoText.trim());
    await fetch("/api/mission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "seed-today-tasks", todos: extras }),
    });
    await setFlow("done");
    setBusy(false);
    onDone();
  }

  if (step === "reminders") {
    return (
      <div className="space-y-3">
        <input
          value={remTitle}
          onChange={(e) => setRemTitle(e.target.value)}
          placeholder="Reminder title"
          className="ui-field"
          autoComplete="off"
        />
        <input
          type="time"
          value={remTime}
          onChange={(e) => setRemTime(e.target.value)}
          className="ui-field"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void addReminder()}
            className="ui-btn ui-btn-ghost"
          >
            Save
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void goTodos()}
            className="ui-btn ui-btn-primary"
          >
            Next
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void goTodos()}
            className="ui-btn-text"
          >
            Skip
          </button>
        </div>
        {msg ? <UiMessage tone={msg.tone}>{msg.text}</UiMessage> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={todoText}
          onChange={(e) => setTodoText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!todoText.trim()) return;
              setTodos((prev) => [...prev, todoText.trim()].slice(0, 8));
              setTodoText("");
            }
          }}
          placeholder="Task for today"
          className="ui-field flex-1"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => {
            if (!todoText.trim()) return;
            setTodos((prev) => [...prev, todoText.trim()].slice(0, 8));
            setTodoText("");
          }}
          className="ui-btn ui-btn-ghost"
        >
          <IconPlus size={14} />
          Add
        </button>
      </div>
      {todos.length ? (
        <ul className="space-y-1 text-sm text-[var(--color-cloud)]">
          {todos.map((t, i) => (
            <li key={`${t}-${i}`} className="flex justify-between gap-2">
              <span>· {t}</span>
              <button
                type="button"
                className="text-xs text-[var(--color-mist)]"
                onClick={() => setTodos((prev) => prev.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void finishTodos()}
          className="ui-btn ui-btn-primary"
        >
          Start day
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            await setFlow("done");
            onDone();
          }}
          className="ui-btn-text"
        >
          Skip
        </button>
      </div>
      {msg ? <UiMessage tone={msg.tone}>{msg.text}</UiMessage> : null}
    </div>
  );
}
