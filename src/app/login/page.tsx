"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { UiMessage } from "@/components/UiMessage";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function demoLogin(who: "you" | "friend") {
    setBusy(who);
    setError("");
    try {
      const res = await signIn("demo", {
        who,
        redirect: false,
        callbackUrl: "/onboarding",
      });
      if (!res || res.error) {
        setError("Sign-in didn’t work. Refresh the page and try once more.");
        setBusy(null);
        return;
      }
      window.location.assign("/onboarding");
    } catch {
      setError("Something went wrong. Check your connection and try again.");
      setBusy(null);
    }
  }

  return (
    <main className="dawn-bg noise relative flex min-h-screen items-center justify-center px-6">
      <div className="relative z-10 w-full max-w-md animate-rise">
        <Link
          href="/"
          className="font-display text-2xl text-[var(--color-dawn)]"
        >
          Dawn
        </Link>
        <h1 className="font-display mt-10 text-4xl text-white">Sign in</h1>
        <p className="mt-3 text-[var(--color-mist)]">
          Start with a demo account to try the morning flow. Use Discord when
          you want friend accountability.
        </p>

        {error ? (
          <div className="mt-5">
            <UiMessage tone="error">{error}</UiMessage>
          </div>
        ) : null}

        <div className="mt-10 flex flex-col gap-3">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void demoLogin("you")}
            className="ui-btn ui-btn-primary w-full"
          >
            {busy === "you" ? "Signing in…" : "Try demo (you)"}
          </button>
          <p className="text-center text-xs text-[var(--color-mist)]">
            Instant — no Discord needed. You’ll set wake time next.
          </p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void demoLogin("friend")}
            className="ui-btn ui-btn-ghost w-full"
          >
            {busy === "friend" ? "Signing in…" : "Try demo as a friend"}
          </button>
          <button
            type="button"
            onClick={() => signIn("discord", { callbackUrl: "/onboarding" })}
            className="mt-2 rounded-full bg-[#5865F2] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#4752c4]"
          >
            Continue with Discord
          </button>
          <p className="text-center text-xs text-[var(--color-mist)]">
            Best for circle check-ins and Discord reminders.
          </p>
        </div>
      </div>
    </main>
  );
}
