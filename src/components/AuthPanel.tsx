"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DawnMark } from "@/components/DawnMark";
import { IconGoogle, IconX } from "@/components/icons";
import { UiMessage } from "@/components/UiMessage";

type Props = {
  onClose?: () => void;
  mode?: "signin" | "signup";
};

function oauthErrorMessage(code: string) {
  if (code === "OAuthCallback" || code === "Callback") {
    return "Sign-in didn’t finish. Tap Google or Discord once more.";
  }
  if (code === "OAuthAccountNotLinked") {
    return "That email is already on another Dawn account. Use the same Google or Discord you used before.";
  }
  if (code === "AccessDenied") {
    return "Sign-in was denied.";
  }
  if (code === "Configuration") {
    return "That login method isn’t configured on this server yet.";
  }
  return "Sign-in didn’t work. Try Google or Discord again.";
}

export function AuthPanel({ onClose, mode = "signin" }: Props) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const signup = mode === "signup";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("error");
    if (!code) return;
    setError(oauthErrorMessage(code));
    params.delete("error");
    const rest = params.toString();
    window.history.replaceState(
      {},
      "",
      rest ? `${window.location.pathname}?${rest}` : window.location.pathname
    );
  }, []);

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
        setError("Sign-in didn’t work. Refresh and try again.");
        setBusy(null);
        return;
      }
      window.location.assign("/onboarding");
    } catch {
      setError("Check your connection and try again.");
      setBusy(null);
    }
  }

  function oauth(provider: "google" | "discord") {
    setBusy(provider);
    setError("");
    void signIn(provider, { callbackUrl: "/dashboard" }).catch(() => {
      setError("Check your connection and try again.");
      setBusy(null);
    });
  }

  const mark = (
    <span className="text-[var(--color-dawn)]">
      <DawnMark size={28} />
    </span>
  );

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-4">
        {onClose ? mark : <Link href="/">{mark}</Link>}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70 hover:border-[var(--color-dawn)] hover:text-[var(--color-dawn)]"
            aria-label="Close"
          >
            <IconX size={16} />
          </button>
        ) : null}
      </div>

      <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-dawn)]">
        {signup ? "Create account" : "Welcome back"}
      </p>
      <h1 className="font-display mt-2 text-4xl text-white sm:text-[2.6rem]">
        {signup ? "Start your Dawn" : "Sign in"}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--color-mist)]">
        {signup
          ? "Google in one tap — or Discord if that’s how your study circle already lives. Then add friends with a code on Friends."
          : "Same Google or Discord you used before. Your habits and board come with you."}
      </p>

      {error ? (
        <div className="mt-5">
          <UiMessage tone="error">{error}</UiMessage>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => oauth("google")}
          className="dawn-btn dawn-btn-google w-full"
        >
          <IconGoogle size={18} />
          {busy === "google"
            ? "Opening Google…"
            : signup
              ? "Sign up with Google"
              : "Continue with Google"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => oauth("discord")}
          className="dawn-btn dawn-btn-discord w-full"
        >
          {busy === "discord"
            ? "Opening Discord…"
            : signup
              ? "Sign up with Discord"
              : "Continue with Discord"}
        </button>
      </div>

      <div className="mt-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-[var(--color-mist)]">
        <span className="h-px flex-1 bg-white/10" />
        or a demo
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void demoLogin("you")}
          className="dawn-btn dawn-btn-ghost w-full"
        >
          {busy === "you" ? "Signing in…" : "Try demo"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void demoLogin("friend")}
          className="dawn-btn dawn-btn-ghost w-full"
        >
          {busy === "friend" ? "Signing in…" : "Demo as a friend"}
        </button>
      </div>

      <p className="mt-8 text-sm text-[var(--color-mist)]">
        {signup ? (
          <>
            Already have Dawn?{" "}
            <Link
              href="/login"
              className="text-[var(--color-dawn)] underline-offset-2 hover:underline"
            >
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link
              href="/signup"
              className="text-[var(--color-dawn)] underline-offset-2 hover:underline"
            >
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
