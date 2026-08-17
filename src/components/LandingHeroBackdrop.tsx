"use client";

import { useRef } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export function LandingHeroBackdrop() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const reduce = useReducedMotion();
  const still = Boolean(reduce) || !inView;

  return (
    <div
      ref={ref}
      className={cn("hero-photo", still && "hero-photo-still")}
      aria-hidden
    >
      <img
        className="hero-photo-img"
        src="/images/landing-hero.png"
        alt=""
        width={1680}
        height={1050}
        fetchPriority="high"
        decoding="async"
      />
      <div className="hero-photo-vignette" />
    </div>
  );
}
