"use client";

import { AuthBrandPanel } from "@/components/AuthBrandPanel";
import { AuthPanel } from "@/components/AuthPanel";

export function AuthScreen({
  mode,
}: {
  mode: "signin" | "signup";
}) {
  return (
    <main className="relative isolate min-h-screen min-h-dvh bg-[#0a0e12]">
      <div
        aria-hidden
        className="hero-photo hero-photo-still hero-photo-auth-mobile lg:hidden"
      >
        <img
          className="hero-photo-img"
          src="/images/landing-hero.jpg"
          alt=""
          width={1800}
          height={1467}
          fetchPriority="high"
          decoding="async"
        />
        <div className="hero-photo-vignette" />
      </div>

      <div className="relative z-10 grid min-h-screen min-h-dvh lg:grid-cols-2">
        <AuthBrandPanel />
        <section className="relative flex items-center justify-center px-5 py-12 sm:px-10 lg:bg-[#0a0e12] lg:px-16">
          <div className="relative z-10 w-full max-w-[26rem] animate-rise">
            <AuthPanel mode={mode} />
          </div>
        </section>
      </div>
    </main>
  );
}
