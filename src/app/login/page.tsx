"use client";

import { AuthPanel } from "@/components/AuthPanel";

export default function LoginPage() {
  return (
    <main className="dawn-bg noise relative flex min-h-screen items-center justify-center px-6">
      <div className="relative z-10 w-full max-w-md animate-rise overflow-hidden rounded-2xl border border-[var(--color-dawn)]/20 bg-[#0a121a]/80 px-6 py-8 sm:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_at_top,rgba(240,180,90,0.22),transparent_70%)]"
        />
        <div className="relative">
          <AuthPanel />
        </div>
      </div>
    </main>
  );
}
