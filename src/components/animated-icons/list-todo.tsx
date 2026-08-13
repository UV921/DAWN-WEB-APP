"use client";

import type { Variants } from "motion/react";
import { motion } from "motion/react";
import { forwardRef, type HTMLAttributes } from "react";
import {
  useIconAnimation,
  type AnimatedIconHandle,
} from "@/components/animated-icons/use-icon-animation";

type Props = HTMLAttributes<HTMLDivElement> & { size?: number };

const CHECK_VARIANTS: Variants = {
  normal: { pathLength: 1, opacity: 1 },
  animate: {
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: { duration: 0.35 },
  },
};

export const ListTodoIcon = forwardRef<AnimatedIconHandle, Props>(
  function ListTodoIcon(
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
          <rect height="18" rx="2" width="18" x="3" y="3" />
          <motion.path
            animate={controls}
            d="m7 8 1.5 1.5L11 7"
            variants={CHECK_VARIANTS}
          />
          <path d="M14 8h4" />
          <path d="M7 12h10" />
          <path d="M7 16h10" />
        </svg>
      </div>
    );
  }
);
