"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DawnMark } from "@/components/DawnMark";
import { IconX } from "@/components/icons";
import { UiMessage } from "@/components/UiMessage";

type Props = {
  onClose?: () => void;
};

function oauthErrorMessage(code: string) {
  if (code === "OAuthCallback" || code === "Callback") {
    return "Discord sign-in didn’t finish. Tap Continue with Discord once more.";
  }
  if (code === "OAuthAccountNotLinked") {
    return "That email is already on another Dawn account. Use the same Discord you used before.";
  }
  if (code === "AccessDenied") {
    return "Discord sign-in was denied.";
  }
  if (code === "Configuration") {
    return "Discord login isn’t configured on this server.";
  }
  return "Sign-in didn’t work. Try Continue with Discord again.";
}

export function AuthPanel({ onClose }: Props) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

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
      <h1 className="font-display mt-8 text-4xl text-white">Sign in</h1>

      {error ? (
        <div className="mt-5">
          <UiMessage tone="error">{error}</UiMessage>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void demoLogin("you")}
          className="dawn-btn w-full"
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
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => {
            setBusy("discord");
            setError("");
            void signIn("discord", { callbackUrl: "/dashboard" }).catch(() => {
              setError("Check your connection and try again.");
              setBusy(null);
            });
          }}
          className="dawn-btn dawn-btn-discord w-full"
        >
          {busy === "discord" ? "Opening Discord…" : "Continue with Discord"}
        </button>
      </div>
    </div>
  );
}
