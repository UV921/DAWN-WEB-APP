"use client";

import { useAnimation } from "motion/react";
import {
  useCallback,
  useImperativeHandle,
  useRef,
  type ForwardedRef,
  type MouseEvent,
} from "react";

export type AnimatedIconHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};

export function useIconAnimation(ref: ForwardedRef<AnimatedIconHandle>) {
  const controls = useAnimation();
  const isControlledRef = useRef(false);

  useImperativeHandle(ref, () => {
    isControlledRef.current = true;
    return {
      startAnimation: () => {
        void controls.start("animate");
      },
      stopAnimation: () => {
        void controls.start("normal");
      },
    };
  });

  const handleMouseEnter = useCallback(
    (
      e: MouseEvent<HTMLDivElement>,
      onMouseEnter?: (e: MouseEvent<HTMLDivElement>) => void
    ) => {
      if (isControlledRef.current) onMouseEnter?.(e);
      else void controls.start("animate");
    },
    [controls]
  );

  const handleMouseLeave = useCallback(
    (
      e: MouseEvent<HTMLDivElement>,
      onMouseLeave?: (e: MouseEvent<HTMLDivElement>) => void
    ) => {
      if (isControlledRef.current) onMouseLeave?.(e);
      else void controls.start("normal");
    },
    [controls]
  );

  return { controls, handleMouseEnter, handleMouseLeave };
}
