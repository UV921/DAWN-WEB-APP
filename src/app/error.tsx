"use client";

import { DawnMark } from "@/components/DawnMark";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/12 bg-[#0d1b2a] p-6 text-center">
        <p className="flex justify-center text-[var(--color-dawn)]">
          <DawnMark size={28} />
        </p>
        <h1 className="font-display mt-4 text-2xl text-white">Dawn hit a snag</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-mist)]">
          A screen failed to load. Reload once — that usually picks up the
          latest version.
        </p>
        <button
          type="button"
          className="dawn-btn mt-6"
          onClick={() => {
            reset();
            window.location.reload();
          }}
        >
          Reload Dawn
        </button>
      </div>
    </main>
  );
}
