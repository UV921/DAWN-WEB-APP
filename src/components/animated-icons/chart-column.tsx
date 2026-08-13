"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  type HTMLAttributes,
} from "react";
import type { AnimatedIconHandle } from "@/components/animated-icons/use-icon-animation";

type Props = HTMLAttributes<HTMLDivElement> & { size?: number };

const LINE_VARIANTS: Variants = {
  visible: { pathLength: 1, opacity: 1 },
  hidden: { pathLength: 0, opacity: 0 },
};

export const ChartColumnIcon = forwardRef<AnimatedIconHandle, Props>(
  function ChartColumnIcon(
    { onMouseEnter, onMouseLeave, className, size = 28, ...props },
    ref
  ) {
    const controls = useAnimation();
    const isControlledRef = useRef(false);

    const replay = useCallback(async () => {
      await controls.start((i: number) => ({
        pathLength: 0,
        opacity: 0,
        transition: { delay: i * 0.1, duration: 0.25 },
      }));
      await controls.start((i: number) => ({
        pathLength: 1,
        opacity: 1,
        transition: { delay: i * 0.1, duration: 0.25 },
      }));
    }, [controls]);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;
      return {
        startAnimation: () => {
          void replay();
        },
        stopAnimation: () => {
          void controls.start("visible");
        },
      };
    });

    return (
      <div
        className={className}
        onMouseEnter={(e) => {
          if (isControlledRef.current) onMouseEnter?.(e);
          else void replay();
        }}
        onMouseLeave={(e) => {
          if (isControlledRef.current) onMouseLeave?.(e);
          else void controls.start("visible");
        }}
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
          <motion.path
            animate={controls}
            custom={1}
            d="M13 17V9"
            initial="visible"
            variants={LINE_VARIANTS}
          />
          <motion.path
            animate={controls}
            custom={2}
            d="M18 17V5"
            initial="visible"
            variants={LINE_VARIANTS}
          />
          <path d="M3 3v16a2 2 0 0 0 2 2h16" />
          <motion.path
            animate={controls}
            custom={0}
            d="M8 17v-3"
            initial="visible"
            variants={LINE_VARIANTS}
          />
        </svg>
      </div>
    );
  }
);
