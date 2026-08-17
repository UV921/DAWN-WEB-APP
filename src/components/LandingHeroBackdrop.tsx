"use client";

import { useRef } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { DawnScene3D } from "@/components/DawnScene3D";
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
        src="/images/landing-hero.jpg"
        alt=""
        width={1680}
        height={1050}
        fetchPriority="high"
        decoding="async"
      />
      <DawnScene3D tone="hero" still={still} />
      <div className="hero-photo-vignette" />
    </div>
  );
}
