"use client";

import type { Variants } from "motion/react";
import { motion } from "motion/react";
import { forwardRef, type HTMLAttributes } from "react";
import {
  useIconAnimation,
  type AnimatedIconHandle,
} from "@/components/animated-icons/use-icon-animation";

type Props = HTMLAttributes<HTMLDivElement> & { size?: number };

const RAYS = [
  "M12 2v2",
  "m19.07 4.93-1.41 1.41",
  "M20 12h2",
  "m17.66 17.66 1.41 1.41",
  "M12 20v2",
  "m6.34 17.66-1.41 1.41",
  "M2 12h2",
  "m4.93 4.93 1.41 1.41",
];

const PATH_VARIANTS: Variants = {
  normal: { opacity: 1 },
  animate: (i: number) => ({
    opacity: [0, 1],
    transition: { delay: i * 0.08, duration: 0.28 },
  }),
};

export const SunIcon = forwardRef<AnimatedIconHandle, Props>(function SunIcon(
  { onMouseEnter, onMouseLeave, className, size = 28, ...props },
  ref
) {
  const { controls, handleMouseEnter, handleMouseLeave } =
    useIconAnimation(ref);

  return (
    <div
      className={className}
      onMouseEnter={(e) => handleMouseEnter(e, onMouseEnter)}
      onMouseLeave={(e) => handleMouseLeave(e, onMouseLeave)}
      {...props}
    >
      <svg
        fill="none"
        height={size}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <circle cx="12" cy="12" r="4" />
        {RAYS.map((d, index) => (
          <motion.path
            animate={controls}
            custom={index + 1}
            d={d}
            key={d}
            variants={PATH_VARIANTS}
          />
        ))}
      </svg>
    </div>
  );
});
