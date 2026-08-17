"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export function ProfileSettings() {
  const { data: session, update } = useSession();
  const [name, setName] = useState("");
  const [identityLine, setIdentityLine] = useState("");
  const [whyLine, setWhyLine] = useState("");
  const [pledgeText, setPledgeText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const u = d.user;
        if (!u) return;
        setName(u.name || "");
        setIdentityLine(u.identityLine || "");
        setWhyLine(u.whyLine || "");
        setPledgeText(u.pledgeText || "");
      })
      .catch(() => undefined);
  }, []);

  async function save() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        identityLine,
        whyLine,
        pledgeText,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg("Could not save profile.");
      return;
    }
    await update();
    setMsg("Profile saved.");
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-display text-2xl text-white sm:text-3xl">
          Your name &amp; lines
        </h2>
        <p className="mt-2 text-sm text-[var(--color-mist)]">
          Change display name and pledges. Wake ask time is under{" "}
          <span className="text-white">Morning</span>.
        </p>
      </div>

      <div className="flex items-center gap-4 steel-plate rounded-2xl bg-white/[0.03] px-4 py-4">
        {session?.user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt=""
            className="h-14 w-14 rounded-full border border-white/20"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-dawn)]/20 font-display text-xl text-[var(--color-dawn)]">
            {(name || "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-medium text-white">
            {name || session?.user?.name || "You"}
          </p>
          <p className="truncate text-sm text-[var(--color-mist)]">
            {session?.user?.email || "No email"}
          </p>
        </div>
      </div>

      <label className="block">
        <span className="text-sm text-[var(--color-mist)]">Display name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="How Dawn should call you"
          className="ui-field mt-2"
        />
      </label>

      <label className="block">
        <span className="text-sm text-[var(--color-mist)]">
          Identity · “I am someone who…”
        </span>
        <input
          value={identityLine}
          onChange={(e) => setIdentityLine(e.target.value)}
          placeholder="wakes early and owns the first hour"
          className="ui-field mt-2"
        />
      </label>

      <label className="block">
        <span className="text-sm text-[var(--color-mist)]">Why mornings matter</span>
        <textarea
          value={whyLine}
          onChange={(e) => setWhyLine(e.target.value)}
          rows={2}
          placeholder="Your real reason — shown on Today"
          className="ui-field mt-2"
        />
      </label>

      <label className="block">
        <span className="text-sm text-[var(--color-mist)]">
          Morning pledge (hold-to-rise)
        </span>
        <textarea
          value={pledgeText}
          onChange={(e) => setPledgeText(e.target.value)}
          rows={2}
          placeholder="I wake by 6 because…"
          className="ui-field mt-2"
        />
      </label>

      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="ui-btn ui-btn-primary"
      >
        {busy ? "Saving…" : "Save profile"}
      </button>
      {msg ? <p className="text-sm text-[var(--color-leaf)]">{msg}</p> : null}
    </section>
  );
}
