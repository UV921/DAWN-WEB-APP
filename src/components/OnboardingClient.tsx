"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ONBOARDING_STEPS,
  buildOnboardingAnalysis,
  mapCelebrate,
  type OnboardingAnswers,
} from "@/lib/onboarding";

type FocusOpt = { key: string; label: string };

export function OnboardingClient() {
  const router = useRouter();
  const { update } = useSession();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<OnboardingAnswers>>({
    currentWake: "08:00",
    wakeGoal: "06:00",
    sleepGoal: "22:30",
    focusHabitKey: "wakeEarly",
    focusLabel: "Wake early",
    celebrate: "big",
  });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/onboarding")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { user?: { onboardingDone?: boolean } } | null) => {
        if (d?.user?.onboardingDone) router.replace("/dashboard");
      })
      .catch(() => undefined);
  }, [router]);

  const visibleSteps = useMemo(() => {
    return ONBOARDING_STEPS.filter((s) => {
      if ("when" in s && typeof s.when === "function") {
        return s.when(answers);
      }
      return true;
    });
  }, [answers]);

  const current = visibleSteps[Math.min(step, visibleSteps.length - 1)];
  const progress = ((step + 1) / visibleSteps.length) * 100;

  function setField(patch: Partial<OnboardingAnswers>) {
    setAnswers((a) => ({ ...a, ...patch }));
  }

  function skip() {
    if (!current) return;
    if (current.id === "focusHabit") {
      nextAfterPatch({
        focusHabitKey: answers.focusHabitKey || "wakeEarly",
        focusLabel: answers.focusLabel || "Wake early",
      });
      return;
    }
    if (current.id === "currentWake" || current.id === "wakeGoal" || current.id === "sleepGoal") {
      const key = current.id;
      const val =
        (answers[key] as string) ||
        ("default" in current ? current.default : "06:00");
      nextAfterPatch({ [key]: val });
      return;
    }
    if (current.id === "whyCustom" || current.id === "focusCustom" || current.id === "identity") {
      next();
      return;
    }
    next();
  }

  function skipRest() {
    void finish();
  }

  function next() {
    if (step < visibleSteps.length - 1) {
      setStep(step + 1);
      setText("");
      setError("");
    } else {
      void finish();
    }
  }

  function back() {
    if (step > 0) {
      setStep(step - 1);
      setText("");
      setError("");
    }
  }

  async function finish() {
    setBusy(true);
    setError("");
    const celebrate = mapCelebrate(
      String(answers.celebrate === "chill" ? "chill" : "big")
    );
    const payload = {
      ...answers,
      celebrate,
      why: answers.why,
      whyCustom: answers.why?.toLowerCase().includes("other")
        ? answers.whyCustom
        : undefined,
    };
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      setError(
        res.status === 401
          ? "Session expired. Sign in with Discord again — not the demo."
          : "Could not save. Try Skip setup once more."
      );
      return;
    }
    await update();
    router.replace("/dashboard");
  }

  function pickChoice(opt: string | FocusOpt) {
    if (!current) return;
    if (current.id === "why") {
      setField({ why: String(opt) });
      if (String(opt).toLowerCase().includes("other")) {
        setStep(step + 1);
        return;
      }
      nextAfterPatch({ why: String(opt) });
      return;
    }
    if (current.id === "friction") {
      nextAfterPatch({ friction: String(opt) });
      return;
    }
    if (current.id === "focusHabit") {
      const o = opt as FocusOpt;
      setField({ focusHabitKey: o.key, focusLabel: o.label });
      if (o.key === "custom") {
        setStep(step + 1);
        return;
      }
      nextAfterPatch({ focusHabitKey: o.key, focusLabel: o.label });
      return;
    }
    if (current.id === "celebrate") {
      const c = mapCelebrate(String(opt));
      nextAfterPatch({ celebrate: c });
      return;
    }
  }

  function nextAfterPatch(patch: Partial<OnboardingAnswers>) {
    const merged = { ...answers, ...patch };
    setAnswers(merged);
    // recompute visible with merged for step advance
    window.setTimeout(() => {
      setStep((s) => s + 1);
      setText("");
    }, 0);
  }

  function submitText() {
    if (!current || !text.trim()) {
      setError("Write a short answer.");
      return;
    }
    if (current.id === "whyCustom") {
      nextAfterPatch({ whyCustom: text.trim(), why: text.trim() });
      return;
    }
    if (current.id === "focusCustom") {
      nextAfterPatch({
        focusCustom: text.trim(),
        focusLabel: text.trim(),
        focusHabitKey: "custom",
      });
      return;
    }
    if (current.id === "identity") {
      nextAfterPatch({ identity: text.trim() });
    }
  }

  if (!current) {
    return (
      <main className="dawn-bg flex min-h-screen items-center justify-center text-[var(--color-mist)]">
        Loading…
      </main>
    );
  }

  return (
    <main className="dawn-bg noise relative min-h-screen">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-lg flex-col px-4 py-8 sm:px-6 sm:py-10"
        style={{
          paddingTop: "max(2rem, env(safe-area-inset-top))",
          paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-xl text-[var(--color-dawn)]">Dawn</p>
          <button
            type="button"
            disabled={busy}
            onClick={skipRest}
            className="ui-chip"
          >
            {busy ? "Saving…" : "Skip setup"}
          </button>
        </div>
        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--color-dawn)] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="ui-kicker mt-3">
        </p>

        <div className="mt-10 animate-rise">
          <h1 className="ui-title mt-2 text-[1.85rem] md:text-4xl">
            {current.prompt}
          </h1>
          {"hint" in current && current.hint && (
            <p className="mt-3 text-[var(--color-mist)]">{current.hint}</p>
          )}

          {current.type === "choice" && current.id === "focusHabit" && (
            <div className="mt-8 flex flex-col gap-2">
              {(current.options as unknown as FocusOpt[]).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  disabled={busy}
                  onClick={() => pickChoice(opt)}
                  className={`rounded-2xl border px-4 py-3.5 text-left text-white transition ${
                    answers.focusHabitKey === opt.key
                      ? "border-[var(--color-dawn)] bg-[var(--color-dawn)]/15"
                      : "border-white/15 bg-white/[0.03] hover:border-[var(--color-dawn)]/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {current.type === "choice" && current.id !== "focusHabit" && (
            <div className="mt-8 flex flex-col gap-2">
              {(current.options as readonly string[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  disabled={busy}
                  onClick={() => pickChoice(opt)}
                  className="rounded-2xl border border-white/15 bg-white/[0.03] px-4 py-3.5 text-left text-white transition hover:border-[var(--color-dawn)]/50"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {current.type === "time" && (
            <div className="mt-8 space-y-4">
              <input
                type="time"
                value={
                  (answers[current.id as keyof OnboardingAnswers] as string) ||
                  ("default" in current ? current.default : "06:00")
                }
                onChange={(e) =>
                  setField({ [current.id]: e.target.value } as Partial<OnboardingAnswers>)
                }
              className="ui-field text-2xl !py-4"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const key = current.id as "currentWake" | "wakeGoal" | "sleepGoal";
                  const val =
                    (answers[key] as string) ||
                    ("default" in current ? current.default : "06:00");
                  nextAfterPatch({ [key]: val });
                }}
                className="ui-btn ui-btn-primary"
              >
                Continue
              </button>
            </div>
          )}

          {current.type === "text" && (
            <div className="mt-8 space-y-4">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  "placeholder" in current && current.placeholder
                    ? current.placeholder
                    : "Type here…"
                }
                className="ui-field !py-4"
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitText();
                }}
              />
              <button
                type="button"
                disabled={busy}
                onClick={submitText}
                className="ui-btn ui-btn-primary"
              >
                Continue
              </button>
            </div>
          )}

          {current.type === "analysis" && (
            <AnalysisPanel
              answers={answers}
              busy={busy}
              onStart={() => void finish()}
            />
          )}

          {error && (
            <p className="mt-4 text-sm text-red-300">{error}</p>
          )}
        </div>

        <div className="sticky bottom-0 mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[var(--color-night)]/90 py-4 backdrop-blur-md">
          <button
            type="button"
            onClick={back}
            disabled={step === 0 || busy}
            className="text-sm text-[var(--color-mist)] disabled:opacity-30"
          >
            Back
          </button>
          <div className="flex flex-wrap items-center gap-3">
            {current.type !== "analysis" ? (
              <button
                type="button"
                disabled={busy}
                onClick={skip}
                className="ui-chip"
              >
                Skip this
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={skipRest}
                className="ui-chip"
              >
                Skip setup
              </button>
            )}
            {busy ? (
              <span className="text-sm text-[var(--color-dawn)]">Saving…</span>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

function AnalysisPanel({
  answers,
  busy,
  onStart,
}: {
  answers: Partial<OnboardingAnswers>;
  busy: boolean;
  onStart: () => void;
}) {
  const a = buildOnboardingAnalysis(answers);
  return (
    <div className="mt-8 space-y-8">
      <p className="text-lg text-[var(--color-cloud)]">{a.verdict}</p>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--color-mist)]">
            Sleep window
          </p>
          <p className="font-display mt-1 text-3xl text-[var(--color-dawn)]">
            {a.sleepHours}h
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--color-mist)]">
            Earlier by
          </p>
          <p className="font-display mt-1 text-3xl text-white">
            {a.stretchMin > 0 ? `${a.stretchMin}m` : "0"}
          </p>
        </div>
      </div>

      {a.strengths.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-leaf)]">
            Working for you
          </p>
          <ul className="mt-3 space-y-2 text-[var(--color-cloud)]">
            {a.strengths.map((s) => (
              <li key={s}>· {s}</li>
            ))}
          </ul>
        </div>
      )}

      {a.risks.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-ember)]">
            Watch outs
          </p>
          <ul className="mt-3 space-y-2 text-[var(--color-cloud)]">
            {a.risks.map((s) => (
              <li key={s}>· {s}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-dawn)]">
          Your 14-day plan
        </p>
        <ol className="mt-3 space-y-3">
          {a.plan.map((p, i) => (
            <li key={p} className="flex gap-3 text-[var(--color-cloud)]">
              <span className="font-mono text-[var(--color-dawn)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={onStart}
        className="ui-btn ui-btn-primary ui-btn-block"
      >
        {busy ? "Saving…" : "Start Dawn"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onStart}
        className="ui-btn-text w-full text-sm"
      >
        Skip — go to Today
      </button>
    </div>
  );
}
