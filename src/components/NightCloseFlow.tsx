"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconCheck,
  IconClock,
  IconPlus,
  IconX,
} from "@/components/icons";
import { DayTallyCard } from "@/components/DayTallyCard";
import { UiMessage } from "@/components/UiMessage";
import { nextCalendarDate } from "@/lib/daily-loop";
import type { DayTally } from "@/lib/day-tally";
import { formatLocalDate } from "@/lib/habits";
import {
  MIN_SLEEP_HOURS,
  sleepDurationHours,
} from "@/lib/sleep-report";

type Step = "remember" | "tasks" | "sleep";

type Draft = { id: string; text: string; time?: string };

type Leftover = { id: string; text: string };

type Props = {
  name?: string;
  sleepGoal: string;
  wakeGoal: string;
  bedtimeLogged?: boolean;
  inSleepWindow?: boolean;
  sleepWindowLabel?: string;
  tally?: DayTally | null;
  onSleepNow: () => void | Promise<void>;
  onSaved?: () => void;
};

const STEPS: Step[] = ["remember", "tasks", "sleep"];

const WAKE_OPTS = ["05:00", "05:30", "06:00", "06:30", "07:00", "07:30", "08:00"];

const TASK_CHIPS = [
  "Make the bed",
  "No phone for 30 min",
  "Water first",
  "Move your body",
];

function rememberChips(wakeGoal: string, sleepGoal: string) {
  return [
    { title: "Wake up", time: wakeGoal },
    { title: "Drink water", time: "08:00" },
    { title: "Phone away", time: sleepGoal },
    { title: "Move / gym", time: "17:00" },
    { title: "Read", time: "21:30" },
  ];
}

/**
 * Full-page night close: remember anything → tomorrow’s tasks → sleep.
 * Same idea as the morning after-wake flow, but it takes the whole Sleep page.
 */
export function NightCloseFlow({
  name,
  sleepGoal,
  wakeGoal,
  bedtimeLogged,
  inSleepWindow = true,
  sleepWindowLabel,
  tally,
  onSleepNow,
  onSaved,
}: Props) {
  const [step, setStep] = useState<Step>("remember");
  const [wantReminders, setWantReminders] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{
    tone: "success" | "error" | "tip";
    text: string;
  } | null>(null);

  const [tomorrow, setTomorrow] = useState(() =>
    nextCalendarDate(formatLocalDate(new Date()))
  );
  const [wake, setWake] = useState(wakeGoal);

  const [remText, setRemText] = useState("");
  const [remTime, setRemTime] = useState("");
  const [reminders, setReminders] = useState<Draft[]>([]);

  const [taskText, setTaskText] = useState("");
  const [tasks, setTasks] = useState<Draft[]>([]);
  const [leftover, setLeftover] = useState<Leftover[]>([]);
  const [carried, setCarried] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const chips = rememberChips(wakeGoal, sleepGoal);
  const hours = sleepDurationHours(sleepGoal, wake);
  const stepIndex = STEPS.indexOf(step);

  useEffect(() => {
    setWake(wakeGoal);
  }, [wakeGoal]);

  useEffect(() => {
    void fetch("/api/day-plan")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.tomorrow === "string") setTomorrow(d.tomorrow);
        if (d.tomorrowPlan?.wakeGoal) setWake(d.tomorrowPlan.wakeGoal);
        if (Array.isArray(d.tomorrowTodos)) {
          setTasks(
            d.tomorrowTodos.map((t: { id: string; text: string }) => ({
              id: t.id,
              text: t.text,
            }))
          );
        }
        if (Array.isArray(d.todos)) {
          setLeftover(
            d.todos
              .filter((t: { done?: boolean; parentId?: string | null }) => {
                return !t.done && !t.parentId;
              })
              .map((t: { id: string; text: string }) => ({
                id: t.id,
                text: t.text,
              }))
          );
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (wantReminders === true || step === "tasks") {
      inputRef.current?.focus();
    }
  }, [wantReminders, step]);

  async function addReminder(title: string, time: string) {
    const text = title.trim();
    if (!text || !/^\d{2}:\d{2}$/.test(time)) {
      setMsg({ tone: "tip", text: "Needs a name and a time." });
      return;
    }
    if (reminders.some((r) => r.text.toLowerCase() === text.toLowerCase())) {
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: text,
        time,
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
      { id: saved?.reminder?.id || `${Date.now()}`, text, time },
    ]);
    setRemText("");
    setRemTime("");
    inputRef.current?.focus();
  }

  async function removeReminder(id: string) {
    if (!id) return;
    setReminders((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/reminders?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).catch(() => undefined);
  }

  async function addTask(raw: string) {
    const text = raw.trim();
    if (!text) return;
    if (tasks.some((t) => t.text.toLowerCase() === text.toLowerCase())) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/day-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add-todo",
        text,
        date: tomorrow,
      }),
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

  async function removeTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch("/api/day-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-todo", id }),
    }).catch(() => undefined);
  }

  async function carryTask(item: Leftover) {
    if (!tomorrow || carried.includes(item.id)) return;
    setBusy(true);
    const res = await fetch("/api/day-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update-todo",
        id: item.id,
        date: tomorrow,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg({ tone: "error", text: "Couldn’t move that task." });
      return;
    }
    setCarried((prev) => [...prev, item.id]);
    setLeftover((prev) => prev.filter((t) => t.id !== item.id));
    setTasks((prev) =>
      prev.some((t) => t.id === item.id)
        ? prev
        : [...prev, { id: item.id, text: item.text }]
    );
  }

  function goTasks() {
    setMsg(null);
    setStep("tasks");
  }

  function goSleep() {
    setMsg(null);
    setStep("sleep");
  }

  async function finish() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/day-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wakeGoal: wake,
      }),
    });
    if (!res.ok) {
      setBusy(false);
      setMsg({ tone: "error", text: "Could not save tomorrow’s plan." });
      return;
    }
    if (inSleepWindow && !bedtimeLogged) {
      try {
        await onSleepNow();
        return;
      } catch (err) {
        setBusy(false);
        setMsg({
          tone: "error",
          text:
            err instanceof Error
              ? err.message
              : "Couldn’t log sleep. Tomorrow’s plan is saved.",
        });
        return;
      }
    }
    onSaved?.();
    setBusy(false);
    setMsg({
      tone: "success",
      text: sleepWindowLabel
        ? `Tomorrow is set. Sleep check-in opens ${sleepWindowLabel}.`
        : "Tomorrow is set.",
    });
  }

  const hello = name ? `${name}, do you have to remember anything?` : "Do you have to remember anything?";

  return (
    <section className="space-y-6">
      <header>
        <p className="ui-kicker">Close the night · {stepIndex + 1} of 3</p>
        <div className="mt-3 flex gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`h-1 flex-1 rounded-full ${
                i <= stepIndex
                  ? "bg-[var(--color-dawn)]"
                  : "bg-white/10"
              }`}
            />
          ))}
        </div>
      </header>

      {tally ? <DayTallyCard tally={tally} compact /> : null}

      {step === "remember" ? (
        <>
          <div>
            <h1 className="ui-title">{hello}</h1>
            <p className="ui-sub mt-3">
              Dawn can nudge you. Pick a few, add your own, or skip.
            </p>
          </div>

          {wantReminders === null ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setWantReminders(true)}
                className="ui-btn ui-btn-primary min-h-[3.25rem]"
              >
                Yes — remind me
              </button>
              <button
                type="button"
                onClick={() => {
                  setWantReminders(false);
                  goTasks();
                }}
                className="ui-btn ui-btn-ghost min-h-[3.25rem]"
              >
                Nothing tonight
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {chips.map((c) => {
                  const on = reminders.some(
                    (r) => r.text.toLowerCase() === c.title.toLowerCase()
                  );
                  return (
                    <button
                      key={c.title}
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void (on
                          ? removeReminder(
                              reminders.find(
                                (r) =>
                                  r.text.toLowerCase() === c.title.toLowerCase()
                              )?.id || ""
                            )
                          : addReminder(c.title, c.time))
                      }
                      className={`ui-chip ${on ? "is-on" : ""}`}
                    >
                      {c.title}
                      <span className="ml-1.5 tabular-nums opacity-70">
                        {c.time}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] py-1 pl-3 pr-1.5">
                <input
                  ref={inputRef}
                  value={remText}
                  onChange={(e) => setRemText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    void addReminder(remText, remTime);
                  }}
                  placeholder="Remind me to…"
                  maxLength={80}
                  autoComplete="off"
                  className="min-w-0 flex-1 border-0 bg-transparent py-2 text-[15px] text-white outline-none placeholder:text-[var(--color-mist)]"
                />
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
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void addReminder(remText, remTime)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--color-dawn)] text-[var(--color-night)] disabled:opacity-40"
                  aria-label="Add reminder"
                >
                  <IconPlus size={16} />
                </button>
              </div>

              {reminders.length ? (
                <ul className="space-y-1">
                  {reminders.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center gap-2 text-sm text-[var(--color-cloud)]"
                    >
                      <IconCheck
                        size={13}
                        className="text-[var(--color-leaf)]"
                      />
                      <span className="min-w-0 flex-1 truncate">{d.text}</span>
                      {d.time ? (
                        <span className="shrink-0 tabular-nums text-xs text-[var(--color-mist)]">
                          {d.time}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void removeReminder(d.id)}
                        className="text-[var(--color-mist)] hover:text-white"
                        aria-label={`Remove ${d.text}`}
                      >
                        <IconX size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--color-mist)]">
                  Add as many as you need. Dawn will ping you at those times.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={goTasks}
                  className="ui-btn ui-btn-primary flex-1"
                >
                  Next · tomorrow’s tasks
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={goTasks}
                  className="ui-btn ui-btn-ghost"
                >
                  Skip
                </button>
              </div>
            </>
          )}
        </>
      ) : null}

      {step === "tasks" ? (
        <>
          <div>
            <h1 className="ui-title">What are tomorrow’s tasks?</h1>
            <p className="ui-sub mt-3">
              They land on Today when you wake. Add many, or bring leftovers
              from today.
            </p>
          </div>

          {leftover.length ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-dawn)]">
                Still open today
              </p>
              <ul className="mt-2 space-y-1.5">
                {leftover.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 text-sm text-[var(--color-cloud)]"
                  >
                    <span className="min-w-0 flex-1 truncate">{item.text}</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void carryTask(item)}
                      className="shrink-0 text-xs text-[var(--color-dawn)]"
                    >
                      Bring to tomorrow
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {TASK_CHIPS.map((label) => {
              const on = tasks.some(
                (t) => t.text.toLowerCase() === label.toLowerCase()
              );
              return (
                <button
                  key={label}
                  type="button"
                  disabled={busy || on}
                  onClick={() => void addTask(label)}
                  className={`ui-chip ${on ? "is-on" : ""}`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] py-1 pl-3 pr-1.5">
            <input
              ref={inputRef}
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                void addTask(taskText);
              }}
              placeholder="Task for tomorrow"
              maxLength={120}
              autoComplete="off"
              className="min-w-0 flex-1 border-0 bg-transparent py-2 text-[15px] text-white outline-none placeholder:text-[var(--color-mist)]"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void addTask(taskText)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--color-dawn)] text-[var(--color-night)] disabled:opacity-40"
              aria-label="Add task"
            >
              <IconPlus size={16} />
            </button>
          </div>

          {tasks.length ? (
            <ul className="space-y-1">
              {tasks.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-2 text-sm text-[var(--color-cloud)]"
                >
                  <IconCheck size={13} className="text-[var(--color-leaf)]" />
                  <span className="min-w-0 flex-1 truncate">{d.text}</span>
                  <button
                    type="button"
                    onClick={() => void removeTask(d.id)}
                    className="text-[var(--color-mist)] hover:text-white"
                    aria-label={`Remove ${d.text}`}
                  >
                    <IconX size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--color-mist)]">
              Empty is fine. You can add more in the morning.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={goSleep}
              className="ui-btn ui-btn-primary flex-1"
            >
              Next · sleep
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setStep("remember")}
              className="ui-btn ui-btn-ghost"
            >
              Back
            </button>
          </div>
        </>
      ) : null}

      {step === "sleep" ? (
        <>
          <div>
            <h1 className="ui-title">
              {inSleepWindow ? "Ready to sleep?" : "Tomorrow is set — almost"}
            </h1>
            <p className="ui-sub mt-3">
              You need at least {MIN_SLEEP_HOURS}h. This plan is {hours}h (
              {sleepGoal} → {wake}).
              {inSleepWindow
                ? " Phone down after you confirm."
                : sleepWindowLabel
                  ? ` Sleep check-in opens ${sleepWindowLabel}.`
                  : ""}
            </p>
          </div>

          <div>
            <p className="text-sm text-[var(--color-mist)]">Tomorrow wake</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {WAKE_OPTS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setWake(t)}
                  className={`ui-chip ${wake === t ? "is-on" : ""}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-sm text-[var(--color-mist)]">
              Or pick a time
              <input
                type="time"
                value={wake}
                onChange={(e) => setWake(e.target.value)}
                className="ui-field mt-2"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-[var(--color-cloud)]">
            <p>
              {reminders.length
                ? `${reminders.length} reminder${reminders.length === 1 ? "" : "s"}`
                : "No extra reminders"}
              {" · "}
              {tasks.length
                ? `${tasks.length} task${tasks.length === 1 ? "" : "s"} for tomorrow`
                : "No tasks set"}
            </p>
          </div>

          {msg ? <UiMessage tone={msg.tone}>{msg.text}</UiMessage> : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void finish()}
              className="ui-btn ui-btn-primary flex-1"
            >
              {bedtimeLogged || !inSleepWindow
                ? "Save tomorrow’s plan"
                : "Save & going to sleep"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setStep("tasks")}
              className="ui-btn ui-btn-ghost"
            >
              Back
            </button>
          </div>
        </>
      ) : null}

      {msg && step !== "sleep" ? (
        <UiMessage tone={msg.tone}>{msg.text}</UiMessage>
      ) : null}
    </section>
  );
}
