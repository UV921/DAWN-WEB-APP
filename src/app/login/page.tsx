"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

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
        setError("Login failed. Refresh and try again.");
        setBusy(null);
        return;
      }
      window.location.assign("/onboarding");
    } catch {
      setError("Login crashed.");
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
          Demo works now. Discord optional for friend accountability.
        </p>

        {error && (
          <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        <div className="mt-10 flex flex-col gap-3">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void demoLogin("you")}
            className="rounded-full bg-[var(--color-dawn)] px-6 py-3.5 text-sm font-semibold text-[var(--color-night)] disabled:opacity-50"
          >
            {busy === "you" ? "Signing in…" : "Demo as You"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void demoLogin("friend")}
            className="rounded-full border border-white/20 px-6 py-3.5 text-sm text-white hover:border-white/40 disabled:opacity-50"
          >
            {busy === "friend" ? "Signing in…" : "Demo as Friend"}
          </button>
          <button
            type="button"
            onClick={() => signIn("discord", { callbackUrl: "/onboarding" })}
            className="mt-2 rounded-full bg-[#5865F2] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#4752c4]"
          >
            Continue with Discord
          </button>
        </div>
      </div>
    </main>
  );
}
