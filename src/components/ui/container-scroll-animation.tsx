"use client";

import React, { useRef } from "react";
import {
  useScroll,
  useTransform,
  motion,
  useReducedMotion,
  type MotionValue,
} from "motion/react";

export const ContainerScroll = ({
  titleComponent,
  children,
}: {
  titleComponent: string | React.ReactNode;
  children: React.ReactNode;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  // Pixel scroll — targeting the ref in useScroll crashes during Next/React 19
  // hydration. Map the first stretch of the page (the hero) so the card
  // starts tilted and flattens as you scroll, instead of 0–1 of the whole page.
  const { scrollY } = useScroll();
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  const heroRange = isMobile ? 360 : 860;
  const scaleDimensions = () => (isMobile ? [0.96, 1] : [1.05, 1]);
  const rotate = useTransform(
    scrollY,
    [0, heroRange],
    reduce ? [0, 0] : isMobile ? [8, 0] : [20, 0]
  );
  const scale = useTransform(
    scrollY,
    [0, heroRange],
    reduce ? [1, 1] : scaleDimensions()
  );
  const translate = useTransform(
    scrollY,
    [0, heroRange],
    reduce ? [0, 0] : isMobile ? [0, -16] : [0, -100]
  );

  return (
    <div
      className="relative flex min-h-[34rem] items-center justify-center overflow-x-clip px-3 py-10 sm:min-h-[42rem] sm:px-4 md:h-[80rem] md:p-20"
      ref={containerRef}
    >
      <div
        className="relative w-full min-w-0 py-6 md:py-40"
        style={{ perspective: "1000px", transformStyle: "preserve-3d" }}
      >
        <Header translate={translate} titleComponent={titleComponent} />
        <Card rotate={rotate} scale={scale}>
          {children}
        </Card>
      </div>
    </div>
  );
};

export const Header = ({
  translate,
  titleComponent,
}: {
  translate: MotionValue<number>;
  titleComponent: string | React.ReactNode;
}) => {
  return (
    <motion.div
      style={{ translateY: translate }}
      className="relative z-20 mx-auto max-w-5xl px-1 text-center"
    >
      {titleComponent}
    </motion.div>
  );
};

export const Card = ({
  rotate,
  scale,
  children,
}: {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  children: React.ReactNode;
}) => {
  return (
    <motion.div
      style={{
        rotateX: rotate,
        scale,
        boxShadow:
          "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003",
      }}
      className="mac-chassis mx-auto mt-6 h-[22rem] w-full max-w-5xl sm:mt-8 sm:h-[28rem] md:mt-14 md:h-[40rem]"
    >
      <div className="mac-bezel">
        <div className="mac-glass">{children}</div>
      </div>
    </motion.div>
  );
};
