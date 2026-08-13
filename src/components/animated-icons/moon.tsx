"use client";

import type { Transition, Variants } from "motion/react";
import { motion } from "motion/react";
import { forwardRef, type HTMLAttributes } from "react";
import {
  useIconAnimation,
  type AnimatedIconHandle,
} from "@/components/animated-icons/use-icon-animation";

type Props = HTMLAttributes<HTMLDivElement> & { size?: number };

const SVG_VARIANTS: Variants = {
  normal: { rotate: 0 },
  animate: { rotate: [0, -10, 10, -5, 5, 0] },
};

const SVG_TRANSITION: Transition = {
  duration: 1.2,
  ease: "easeInOut",
};

export const MoonIcon = forwardRef<AnimatedIconHandle, Props>(function MoonIcon(
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
      <motion.svg
        animate={controls}
        fill="none"
        height={size}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        transition={SVG_TRANSITION}
        variants={SVG_VARIANTS}
        viewBox="0 0 24 24"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </motion.svg>
    </div>
  );
});
