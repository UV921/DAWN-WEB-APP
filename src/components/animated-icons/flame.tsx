"use client";

import type { Variants } from "motion/react";
import { motion } from "motion/react";
import { forwardRef, type HTMLAttributes } from "react";
import {
  useIconAnimation,
  type AnimatedIconHandle,
} from "@/components/animated-icons/use-icon-animation";

type Props = HTMLAttributes<HTMLDivElement> & { size?: number };

const SVG_VARIANTS: Variants = {
  normal: { scale: 1, rotate: 0 },
  animate: {
    scale: [1, 1.12, 0.96, 1.06, 1],
    rotate: [0, -4, 4, -2, 0],
  },
};

export const FlameIcon = forwardRef<AnimatedIconHandle, Props>(
  function FlameIcon(
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
          transition={{ duration: 0.7, ease: "easeInOut" }}
          variants={SVG_VARIANTS}
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </motion.svg>
      </div>
    );
  }
);
