"use client";

import { useCallback, useEffect, useState } from "react";
import type { HabitDef } from "@/lib/habits";
import type { LifeBrief } from "@/lib/personal-life";
import { PersonalBriefCard } from "@/components/PersonalBriefCard";

type Question = {
  id: string;
  section?: string;
  prompt: string;
  hint?: string;
  options?: readonly string[];
  freeText: boolean;
  placeholder?: string;
};

type HabitRow = HabitDef & {
  id: string;
  active: boolean;
  windowStart?: string | null;
  windowEnd?: string | null;
};

type Suggestion = {
  key: string;
  label: string;
  description: string;
  reason: string;
};

const QUICK_DEFAULTS = [
  { key: "sleepEarly", label: "Sleep early", description: "In bed by your sleep goal" },
  { key: "wakeEarly", label: "Wake early", description: "Up by your wake goal" },
  { key: "noPhone", label: "No phone", description: "Phone away first stretch of morning" },
  { key: "gym", label: "Gym", description: "Morning training" },
  { key: "reading", label: "Reading", description: "Morning reading" },
  { key: "quran", label: "Quran", description: "Morning Quran" },
  { key: "fajr", label: "Fajr", description: "Pray Fajr on time" },
  { key: "walk", label: "Morning walk", description: "10–20 min walk / sunlight" },
  { key: "journal", label: "Journal", description: "5–10 min journal" },
];

export function HabitStudio({ onChanged }: { onChanged?: () => void }) {
  const [all, setAll] = useState<HabitRow[]>([]);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [draftText, setDraftText] = useState("");
  const [picked, setPicked] = useState("");
  const [interviewing, setInterviewing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [focus, setFocus] = useState("");
  const [tonightTip, setTonightTip] = useState("");
  const [brief, setBrief] = useState<LifeBrief | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [lockedHabits, setLockedHabits] = useState<Suggestion[]>([]);
  const [usedAi, setUsedAi] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/habit-defs");
    if (!res.ok) return;
    const data = await res.json();
    setAll(data.all || []);
  }, []);

  useEffect(() => {
    void load();
    void fetch("/api/coach/interview")
      .then((r) => r.json())
      .then((d) => {
        setQuestions(d.questions || []);
        if (d.savedBrief) setBrief(d.savedBrief);
        if (d.savedAnswers && Object.keys(d.savedAnswers).length) {
          setAnswers(d.savedAnswers);
        }
      })
      .catch(() => undefined);
  }, [load]);

  async function addHabit(payload: {
    key?: string;
    label: string;
    description?: string;
  }) {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/habit-defs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMsg(err.error || "Could not add habit");
      return false;
    }
    setLabel("");
    setDescription("");
    setMsg("Habit added.");
    await load();
    onChanged?.();
    return true;
  }

  async function toggleActive(id: string, active: boolean) {
    setBusy(true);
    await fetch("/api/habit-defs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active }),
    });
    setBusy(false);
    await load();
    onChanged?.();
  }

  async function removeHabit(id: string) {
    setBusy(true);
    await fetch(`/api/habit-defs?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    setBusy(false);
    await load();
    onChanged?.();
  }

  async function saveWindow(
    id: string,
    windowStart: string | null,
    windowEnd: string | null
  ) {
    setBusy(true);
    await fetch("/api/habit-defs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        windowStart,
        windowEnd,
        clearWindow: !windowStart || !windowEnd,
      }),
    });
    setBusy(false);
    await load();
    onChanged?.();
  }

  async function reenableDefault(key: string) {
    const inactive = all.find((h) => h.key === key && !h.active);
    if (inactive?.id) {
      await toggleActive(inactive.id, true);
      return;
    }
    const def = QUICK_DEFAULTS.find((d) => d.key === key);
    if (def) await addHabit(def);
  }

  function advance(nextAnswers: Record<string, string>) {
    setAnswers(nextAnswers);
    setDraftText("");
    setPicked("");
    if (step + 1 < questions.length) {
      setStep(step + 1);
    } else {
      void runAnalysis(nextAnswers);
    }
  }

  function continueQuestion() {
    const q = questions[step];
    if (!q) return;
    const text = draftText.trim();
    const choice = picked.trim();
    const combined = [choice, text].filter(Boolean).join(" — ");
    if (!combined) return;
    advance({ ...answers, [q.id]: combined });
  }

  function skipQuestion() {
    const q = questions[step];
    if (!q) return;
    advance({ ...answers });
  }

  function skipRemaining() {
    const q = questions[step];
    const text = draftText.trim();
    const choice = picked.trim();
    const combined = [choice, text].filter(Boolean).join(" — ");
    const next =
      q && combined ? { ...answers, [q.id]: combined } : { ...answers };
    void runAnalysis(next);
  }

  async function runAnalysis(ans: Record<string, string>) {
    setAnalyzing(true);
    setInterviewing(false);
    setMsg("");
    const res = await fetch("/api/coach/interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: ans }),
    });
    setAnalyzing(false);
    if (!res.ok) {
      setMsg("Could not analyze — try again.");
      return;
    }
    const data = await res.json();
    setAnalysis(data.analysis || "");
    setFocus(data.focus || "");
    setTonightTip(data.tonightTip || "");
    setSuggestions(data.suggestedHabits || []);
    setLockedHabits(data.lockedHabits || []);
    setUsedAi(Boolean(data.usedAi));
    setProvider(data.provider || null);
    if (data.personalBrief) setBrief(data.personalBrief);
    await load();
    onChanged?.();
  }

  async function addSuggestion(s: Suggestion) {
    const ok = await addHabit({
      key: s.key,
      label: s.label,
      description: s.description,
    });
    if (ok) {
      setSuggestions((prev) => prev.filter((x) => x.key !== s.key));
    }
  }

  const activeKeys = new Set(all.filter((h) => h.active).map((h) => h.key));
  const currentQ = questions[step];
  const hasProfile = Boolean(brief);

  return (
    <section className="mt-10 space-y-10 border-t border-white/10 pt-10">
      {/* Personal life interview first */}
      <div className="rounded-2xl border border-[var(--color-dawn)]/25 bg-[var(--color-dawn)]/[0.06] p-5">
        <h2 className="font-display text-3xl text-white">Know your life</h2>
        <p className="mt-2 text-sm text-[var(--color-mist)]">
          Wide questions so Dawn actually knows you — work, home, nights, what
          already failed. Skip any that don’t help. When you finish, Dawn locks
          2–4 habits onto Today from your answers (AI if it’s on).
        </p>

        {brief && !interviewing && !analyzing ? (
          <div className="mt-5">
            <PersonalBriefCard brief={brief} />
          </div>
        ) : null}

        {!interviewing && !analyzing && (
          <button
            type="button"
            onClick={() => {
              setInterviewing(true);
              setStep(0);
              setDraftText("");
              setPicked("");
              setAnalysis("");
              setSuggestions([]);
              setLockedHabits([]);
            }}
            className="mt-5 rounded-full bg-[var(--color-dawn)] px-6 py-2.5 text-sm font-semibold text-[var(--color-night)]"
          >
            {hasProfile ? "Update personal answers" : "Tell Dawn your life"}
          </button>
        )}

        {interviewing && currentQ && (
          <div className="mt-6 space-y-4">
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-dawn)]">
              {currentQ.section || "You"} · {step + 1} / {questions.length}
            </p>
            <p className="text-xl text-white">{currentQ.prompt}</p>
            {currentQ.hint ? (
              <p className="text-sm text-[var(--color-mist)]">{currentQ.hint}</p>
            ) : null}

            {currentQ.options?.length ? (
              <div className="flex flex-wrap gap-2">
                {currentQ.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setPicked(opt)}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      picked === opt
                        ? "border-[var(--color-dawn)] bg-[var(--color-dawn)]/15 text-[var(--color-dawn)]"
                        : "border-white/20 text-white hover:border-[var(--color-dawn)]"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : null}

            {currentQ.freeText ? (
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={3}
                placeholder={
                  currentQ.placeholder || "Write the real answer…"
                }
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none focus:border-[var(--color-dawn)]"
              />
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!picked && !draftText.trim()}
                onClick={() => continueQuestion()}
                className="rounded-full bg-[var(--color-dawn)] px-6 py-2.5 text-sm font-semibold text-[var(--color-night)] disabled:opacity-40"
              >
                {step + 1 >= questions.length ? "Lock my habits" : "Continue"}
              </button>
              <button
                type="button"
                onClick={() => skipQuestion()}
                className="text-sm text-[var(--color-mist)] hover:text-white"
              >
                Skip this
              </button>
              <button
                type="button"
                onClick={() => skipRemaining()}
                className="text-sm text-[var(--color-mist)] hover:text-white"
              >
                Skip remaining
              </button>
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setStep((s) => Math.max(0, s - 1));
                    setDraftText("");
                    setPicked("");
                  }}
                  className="text-sm text-[var(--color-mist)] hover:text-white"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setInterviewing(false);
                  setDraftText("");
                  setPicked("");
                }}
                className="text-sm text-[var(--color-mist)] hover:text-white"
              >
                Not now
              </button>
            </div>
          </div>
        )}

        {analyzing && (
          <p className="mt-5 text-[var(--color-mist)]">
            Reading your life + logs — locking a small habit stack…
          </p>
        )}

        {(analysis || suggestions.length > 0 || lockedHabits.length > 0) &&
          !interviewing &&
          !analyzing && (
          <div className="mt-5 space-y-4 border-t border-white/10 pt-5">
            {analysis && (
              <p className="text-[var(--color-cloud)] leading-relaxed">
                {analysis}
              </p>
            )}
            {focus && (
              <p className="text-sm text-[var(--color-dawn)]">Focus: {focus}</p>
            )}
            {tonightTip && (
              <p className="text-sm text-[var(--color-mist)]">
                Tonight: {tonightTip}
              </p>
            )}
            {lockedHabits.length > 0 ? (
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-leaf)]">
                  Locked on Today
                </p>
                <ul className="mt-2 space-y-2">
                  {lockedHabits.map((s) => (
                    <li
                      key={s.key}
                      className="rounded-xl border border-[var(--color-leaf)]/25 bg-[var(--color-leaf)]/[0.06] px-4 py-3"
                    >
                      <p className="font-medium text-white">{s.label}</p>
                      <p className="text-sm text-[var(--color-mist)]">
                        {s.description}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-leaf)]">
                        {s.reason}
                      </p>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-[var(--color-mist)]">
                  Hide any from Habits below if you don’t want it.
                </p>
              </div>
            ) : null}
            <p className="text-xs text-[var(--color-mist)]">
              {usedAi
                ? `Prescribed via ${provider || "AI"}`
                : "Local prescription (AI offline / fallback)"}
            </p>
            <ul className="space-y-2">
              {suggestions.map((s) => (
                <li
                  key={s.key}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-white">{s.label}</p>
                    <p className="text-sm text-[var(--color-mist)]">
                      {s.description}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-leaf)]">
                      {s.reason}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy || activeKeys.has(s.key)}
                    onClick={() => void addSuggestion(s)}
                    className="rounded-full border border-[var(--color-dawn)]/50 px-3 py-1.5 text-xs text-[var(--color-dawn)] disabled:opacity-40"
                  >
                    {activeKeys.has(s.key) ? "Added" : "Add"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <h2 className="font-display text-3xl text-white">Habits & windows</h2>
        <p className="mt-2 text-[var(--color-mist)]">
          Each habit only accepts a check during its window. Leave blank to use
          defaults from your wake/sleep goals.
        </p>
      </div>

      <div>
        <p className="text-sm uppercase tracking-[0.15em] text-[var(--color-mist)]">
          Quick add
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_DEFAULTS.map((d) => {
            const on = activeKeys.has(d.key);
            return (
              <button
                key={d.key}
                type="button"
                disabled={busy || on}
                onClick={() => void reenableDefault(d.key)}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                  on
                    ? "border-[var(--color-dawn)]/40 bg-[var(--color-dawn)]/10 text-[var(--color-dawn)]"
                    : "border-white/20 text-white hover:border-[var(--color-dawn)]"
                } disabled:opacity-50`}
              >
                {on ? `✓ ${d.label}` : `+ ${d.label}`}
              </button>
            );
          })}
        </div>
      </div>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!label.trim()) return;
          void addHabit({ label: label.trim(), description: description.trim() });
        }}
      >
        <p className="text-sm uppercase tracking-[0.15em] text-[var(--color-mist)]">
          Custom habit
        </p>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Cold shower"
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none focus:border-[var(--color-dawn)]"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description (optional)"
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none focus:border-[var(--color-dawn)]"
        />
        <button
          type="submit"
          disabled={busy || !label.trim()}
          className="rounded-full bg-[var(--color-dawn)] px-6 py-2.5 text-sm font-semibold text-[var(--color-night)] disabled:opacity-50"
        >
          Add habit
        </button>
      </form>

      <ul className="space-y-3">
        {all.map((h) => (
          <li
            key={h.id}
            className={`rounded-2xl border px-4 py-4 ${
              h.active
                ? "border-white/10 bg-white/[0.03]"
                : "border-white/5 bg-transparent opacity-50"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-white">
                  {h.label}
                  {h.isDefault ? (
                    <span className="ml-2 text-xs text-[var(--color-mist)]">
                      default
                    </span>
                  ) : null}
                </p>
                {h.description ? (
                  <p className="text-sm text-[var(--color-mist)]">
                    {h.description}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void toggleActive(h.id, !h.active)}
                  className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-white"
                >
                  {h.active ? "Hide" : "Show"}
                </button>
                {!h.isDefault && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeHabit(h.id)}
                    className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[var(--color-mist)] hover:text-white"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
            {h.active ? (
              <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-white/10 pt-3">
                <label className="text-xs text-[var(--color-mist)]">
                  Window start
                  <input
                    type="time"
                    defaultValue={h.windowStart || ""}
                    key={`${h.id}-s-${h.windowStart || "d"}`}
                    className="mt-1 block rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white"
                    id={`ws-${h.id}`}
                  />
                </label>
                <label className="text-xs text-[var(--color-mist)]">
                  Window end
                  <input
                    type="time"
                    defaultValue={h.windowEnd || ""}
                    key={`${h.id}-e-${h.windowEnd || "d"}`}
                    className="mt-1 block rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white"
                    id={`we-${h.id}`}
                  />
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const s = (
                      document.getElementById(`ws-${h.id}`) as HTMLInputElement
                    )?.value;
                    const e = (
                      document.getElementById(`we-${h.id}`) as HTMLInputElement
                    )?.value;
                    void saveWindow(h.id, s || null, e || null);
                  }}
                  className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-white"
                >
                  Save window
                </button>
                {(h.windowStart || h.windowEnd) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void saveWindow(h.id, null, null)}
                    className="text-xs text-[var(--color-mist)] hover:text-white"
                  >
                    Use default
                  </button>
                )}
                {!h.windowStart && !h.windowEnd ? (
                  <p className="w-full text-xs text-[var(--color-mist)]">
                    Using default window from wake/sleep goals
                  </p>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {msg && <p className="text-sm text-[var(--color-leaf)]">{msg}</p>}
    </section>
  );
}
