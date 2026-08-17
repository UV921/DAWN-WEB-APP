"use client";

import { useEffect, useState } from "react";
import { FlowSteps, IconPlus, IconSparkles } from "@/components/icons";
import { NightClosed } from "@/components/NightClosed";
import {
  MIN_SLEEP_HOURS,
  sleepDurationHours,
} from "@/lib/sleep-report";

type Props = {
  sleepGoal: string;
  wakeGoal: string;
  bedtimeLogged?: boolean;
  onSleepNow: () => void | Promise<void>;
  onSaved?: () => void;
};

/** Evening: set tomorrow’s intention, then close the day. */
export function CloseDayPanel({
  sleepGoal,
  wakeGoal,
  bedtimeLogged,
  onSleepNow,
  onSaved,
}: Props) {
  const [goalText, setGoalText] = useState("");
  const [wake, setWake] = useState(wakeGoal);
  const [todo, setTodo] = useState("");
  const [todos, setTodos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nightDone, setNightDone] = useState(Boolean(bedtimeLogged));
  const [msg, setMsg] = useState("");
  const [tip, setTip] = useState("");
  const [aiReady, setAiReady] = useState(false);

  useEffect(() => {
    setWake(wakeGoal);
  }, [wakeGoal]);

  useEffect(() => {
    if (bedtimeLogged) setNightDone(true);
  }, [bedtimeLogged]);

  useEffect(() => {
    void fetch("/api/day-plan")
      .then((r) => r.json())
      .then((d) => {
        if (d.tomorrowPlan?.goalText) setGoalText(d.tomorrowPlan.goalText);
        if (d.tomorrowPlan?.wakeGoal) setWake(d.tomorrowPlan.wakeGoal);
        if (d.tomorrowTodos?.length) {
          setTodos(d.tomorrowTodos.map((t: { text: string }) => t.text));
        }
      })
      .catch(() => undefined);

    void fetch("/api/coach/tonight")
      .then((r) => r.json())
      .then((d) => setAiReady(Boolean(d.configured)))
      .catch(() => undefined);
  }, []);

  function addTodo() {
    const t = todo.trim();
    if (!t) return;
    setTodos((prev) => [...prev, t].slice(0, 8));
    setTodo("");
  }

  async function suggestFromHistory() {
    setAiBusy(true);
    setMsg("");
    const res = await fetch("/api/coach/tonight", { method: "POST" });
    setAiBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMsg(
        err.error ||
          "AI suggestion failed. You can still write tomorrow by hand."
      );
      return;
    }
    const data = await res.json();
    const plan = data.plan as {
      tip?: string;
      goalText?: string;
      todos?: string[];
      bedBy?: string;
    };
    if (plan.goalText) setGoalText(plan.goalText);
    if (plan.todos?.length) setTodos(plan.todos.slice(0, 4));
    if (plan.tip) setTip(plan.tip);
    setMsg(
      plan.tip
        ? `From your last week · ${data.provider || "AI"}`
        : "Suggestion filled — edit anything."
    );
  }

  async function savePlan() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/day-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wakeGoal: wake,
        goalText,
        todos,
        replaceTodos: true,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg("Could not save tonight’s plan.");
      return;
    }
    const data = await res.json();
    setSaved(true);
    setMsg(
      data.xpGained
        ? `Tomorrow is set · +${data.xpGained} XP. Log sleep to keep the streak.`
        : "Tomorrow is set. Log sleep to keep the streak."
    );
    onSaved?.();
  }

  async function saveAndSleep() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/day-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wakeGoal: wake,
        goalText,
        todos,
        replaceTodos: true,
      }),
    });
    if (!res.ok) {
      setBusy(false);
      setMsg("Could not save tonight’s plan.");
      return;
    }
    setNightDone(true);
    if (!bedtimeLogged) await onSleepNow();
    onSaved?.();
    setBusy(false);
  }

  if (nightDone) {
    return <NightClosed sleepGoal={sleepGoal} wakeGoal={wake} />;
  }

  return (
    <section className="ui-section">
      <p className="ui-kicker">Close the day</p>
      <h2 className="ui-title mt-2 text-[1.75rem] sm:text-3xl">
        Set tomorrow before you sleep
      </h2>
      <p className="ui-sub mt-2">
        You need at least {MIN_SLEEP_HOURS}h. Your plan is{" "}
        {sleepDurationHours(sleepGoal, wake)}h ({sleepGoal} → {wake}). Set
        tomorrow’s tasks now so you don’t procrastinate in the morning.
      </p>

      {aiReady ? (
        <button
          type="button"
          disabled={aiBusy}
          onClick={() => void suggestFromHistory()}
          className="ui-btn ui-btn-ghost mt-4 text-[var(--color-dawn)]"
        >
          <IconSparkles size={16} />
          {aiBusy ? "Reading your week…" : "Suggest from my wake history"}
        </button>
      ) : null}

      {tip ? (
        <p className="mt-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-[var(--color-cloud)]">
          {tip}
        </p>
      ) : null}

      <label className="mt-5 block text-sm text-[var(--color-mist)]">
        Tomorrow wake by
        <input
          type="time"
          value={wake}
          onChange={(e) => setWake(e.target.value)}
          className="ui-field mt-2"
        />
      </label>

      <label className="mt-4 block text-sm text-[var(--color-mist)]">
        One sentence for tomorrow morning
        <input
          value={goalText}
          onChange={(e) => setGoalText(e.target.value)}
          placeholder="e.g. Out of bed, water, no phone for 30 min"
          className="ui-field mt-2"
        />
      </label>

      <div className="mt-4">
        <p className="text-sm text-[var(--color-mist)]">Tiny todos (optional)</p>
        <div className="mt-2 flex gap-2">
          <input
            value={todo}
            onChange={(e) => setTodo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTodo();
              }
            }}
            placeholder="Add one…"
            className="ui-field flex-1 !py-2.5"
          />
          <button
            type="button"
            onClick={addTodo}
            className="ui-btn ui-btn-ghost ui-btn-sm"
          >
            <IconPlus size={14} />
            Add
          </button>
        </div>
        {todos.length ? (
          <ul className="mt-2 space-y-1">
            {todos.map((t, i) => (
              <li
                key={`${t}-${i}`}
                className="flex items-center justify-between text-sm text-[var(--color-cloud)]"
              >
                <span>· {t}</span>
                <button
                  type="button"
                  onClick={() =>
                    setTodos((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="text-xs text-[var(--color-mist)]"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveAndSleep()}
          className="ui-btn ui-btn-primary disabled:opacity-50"
        >
          {bedtimeLogged ? "Save tomorrow’s plan" : "Save & going to sleep"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void savePlan()}
          className="ui-btn ui-btn-ghost"
        >
          Save plan only
        </button>
      </div>
      {msg ? (
        <p
          className={`mt-3 text-sm ${
            saved
              ? "text-[var(--color-leaf)]"
              : msg.toLowerCase().includes("could") ||
                  msg.toLowerCase().includes("fail")
                ? "text-red-300"
                : "text-[var(--color-leaf)]"
          }`}
        >
          {msg}
        </p>
      ) : (
        <p className="mt-3 text-xs text-[var(--color-mist)]">
          Flow: <FlowSteps steps={["plan tomorrow", "sleep", "wake"]} />
        </p>
      )}
    </section>
  );
}
