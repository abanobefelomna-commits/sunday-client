"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const MOTION = {
  duration: {
    micro: 0.14,
    enter: 0.26,
    chart: 0.34,
  },
  ease: EASE_OUT,
  stagger: 0.045,
} as const;

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0.97, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: MOTION.duration.enter, ease: MOTION.ease, delay }
      }
    >
      {children}
    </motion.div>
  );
}

export function MotionCard({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.article
      className={className}
      style={style}
      layout={!reduceMotion}
      whileHover={reduceMotion ? undefined : { y: -3 }}
      transition={{ duration: reduceMotion ? 0 : MOTION.duration.micro, ease: MOTION.ease }}
    >
      {children}
    </motion.article>
  );
}

export function SessionIntro({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const controls = useAnimationControls();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    try {
      const key = "sunday-school-landing-intro";
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "played");
      void controls.start({
        opacity: [0.97, 1],
        y: [7, 0],
        transition: { duration: 0.42, ease: MOTION.ease },
      });
    } catch {
      // Storage may be unavailable in private browsing; content remains visible.
    }
  }, [controls, reduceMotion]);

  return (
    <motion.div className={className} initial={false} animate={controls}>
      {children}
    </motion.div>
  );
}
