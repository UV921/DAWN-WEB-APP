"use client";

import { useEffect, useState } from "react";
import { IconPlus } from "@/components/icons";

type Props = {
  open: boolean;
  /** Resume mid-flow if user left during todos */
  initialStep?: "reminders" | "todos";
  onDone: () => void;
};

/**
 * After hold-to-rise: ask reminders, then todos.
 */
export function MorningAfterWake({
  open,
  initialStep = "reminders",
  onDone,
}: Props) {
  const [step, setStep] = useState<"reminders" | "todos">(initialStep);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // Reminder draft
  const [remTitle, setRemTitle] = useState("");
  const [remTime, setRemTime] = useState("");

  // Todo draft
  const [todoText, setTodoText] = useState("");
  const [todos, setTodos] = useState<string[]>([]);

  useEffect(() => {
    if (open) setStep(initialStep);
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
      setMsg("Add a title and time.");
      return;
    }
    setBusy(true);
    setMsg("");
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
      setMsg("Could not save reminder.");
      return;
    }
    setRemTitle("");
    setRemTime("");
    setMsg("Reminder saved.");
  }

  async function finishReminders(hasMore: boolean) {
    if (hasMore && remTitle.trim()) await addReminder();
    setBusy(true);
    await setFlow("todos");
    // Seed mission task templates onto today
    await fetch("/api/mission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "seed-today-tasks", todos: [] }),
    });
    setBusy(false);
    setStep("todos");
    setMsg("");
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

  return (
    <section className="rounded-2xl border border-[var(--color-dawn)]/35 bg-[var(--color-dawn)]/[0.08] px-5 py-5">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-dawn)]">
        Morning series · step {step === "reminders" ? "1" : "2"} of 2
      </p>

      {step === "reminders" ? (
        <>
          <h2 className="font-display mt-2 text-2xl text-white">
            Any reminders for today?
          </h2>
          <p className="mt-2 text-sm text-[var(--color-mist)]">
            After wake — set a ping if you need one (or skip).
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={remTitle}
              onChange={(e) => setRemTitle(e.target.value)}
              placeholder="e.g. Call mom, Deep work"
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none focus:border-[var(--color-dawn)]"
            />
            <input
              type="time"
              value={remTime}
              onChange={(e) => setRemTime(e.target.value)}
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-white outline-none focus:border-[var(--color-dawn)]"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void addReminder()}
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Save reminder
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void finishReminders(true)}
              className="rounded-full bg-[var(--color-dawn)] px-5 py-2 text-sm font-semibold text-[var(--color-night)] disabled:opacity-50"
            >
              Next · todos
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void finishReminders(false)}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-[var(--color-mist)]"
            >
              No reminders
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 className="font-display mt-2 text-2xl text-white">
            Any todos for today?
          </h2>
          <p className="mt-2 text-sm text-[var(--color-mist)]">
            Mission daily tasks are added automatically. Add more if you want.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              value={todoText}
              onChange={(e) => setTodoText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!todoText.trim()) return;
                  setTodos((prev) => [...prev, todoText.trim()]);
                  setTodoText("");
                }
              }}
              placeholder="Add a todo…"
              className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none focus:border-[var(--color-dawn)]"
            />
            <button
              type="button"
              onClick={() => {
                if (!todoText.trim()) return;
                setTodos((prev) => [...prev, todoText.trim()]);
                setTodoText("");
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-4 text-sm text-white"
            >
              <IconPlus size={14} />
              Add
            </button>
          </div>
          {todos.length ? (
            <ul className="mt-2 space-y-1 text-sm text-[var(--color-cloud)]">
              {todos.map((t, i) => (
                <li key={`${t}-${i}`}>· {t}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void finishTodos()}
              className="rounded-full bg-[var(--color-dawn)] px-5 py-2.5 text-sm font-semibold text-[var(--color-night)] disabled:opacity-50"
            >
              Done · start the day
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setTodos([]);
                setTodoText("");
                await setFlow("done");
                onDone();
              }}
              className="rounded-full border border-white/10 px-4 py-2.5 text-sm text-[var(--color-mist)]"
            >
              No todos
            </button>
          </div>
        </>
      )}
      {msg ? <p className="mt-3 text-sm text-[var(--color-leaf)]">{msg}</p> : null}
    </section>
  );
}
