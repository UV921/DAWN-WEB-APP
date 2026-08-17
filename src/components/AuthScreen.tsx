"use client";

import { AuthBrandPanel } from "@/components/AuthBrandPanel";
import { AuthPanel } from "@/components/AuthPanel";

export function AuthScreen({
  mode,
}: {
  mode: "signin" | "signup";
}) {
  return (
    <main className="dawn-bg grid min-h-screen min-h-dvh lg:grid-cols-2">
      <AuthBrandPanel />
      <section className="relative flex items-center justify-center px-5 py-10 sm:px-10 lg:px-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_at_top,rgba(240,180,90,0.12),transparent_70%)] lg:hidden"
        />
        <div className="relative z-10 w-full max-w-[26rem] animate-rise">
          <AuthPanel mode={mode} />
        </div>
      </section>
    </main>
  );
}
