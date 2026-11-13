"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect } from "react";
import {
  motion,
  useAnimationControls,
  useReducedMotion,
  type Variants,
} from "framer-motion";

/**
 * Central motion language for the whole product.
 *
 * Rules:
 * - transform/opacity only (GPU friendly on mobile)
 * - one shared easing curve and a small duration scale
 * - entrance animations happen once, when the element enters the viewport
 * - reduced-motion users get instantly visible content
 */
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const MOTION = {
  duration: {
    micro: 0.16,
    fast: 0.24,
    enter: 0.42,
    chart: 0.34,
  },
  ease: EASE_OUT,
  distance: 16,
  stagger: 0.06,
  viewport: { once: true, amount: 0.18, margin: "0px 0px -8% 0px" } as const,
} as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: MOTION.distance },
  visible: { opacity: 1, y: 0 },
};

const fadeUpSmall: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export interface MotionInViewProps {
  children: ReactNode;
  id?: string;
  className?: string;
  /** Seconds. Kept small so content never feels delayed. */
  delay?: number;
  /** 0–1 fraction of the element that must be visible. */
  amount?: number;
  style?: CSSProperties;
  as?: "div" | "section" | "article" | "aside";
  ariaLabel?: string;
}

/**
 * Canonical entrance wrapper. Elements start hidden and animate in the first
 * time they enter the viewport; they never replay on state updates.
 */
export function MotionInView({
  children,
  id,
  className,
  delay = 0,
  amount = MOTION.viewport.amount,
  style,
  as = "div",
  ariaLabel,
}: MotionInViewProps) {
  const reduceMotion = useReducedMotion();
  const MotionTag = motion[as] as typeof motion.div;

  return (
    <MotionTag
      id={id}
      data-motion="in-view"
      className={className}
      style={style}
      aria-label={ariaLabel}
      variants={fadeUp}
      initial={reduceMotion ? false : "hidden"}
      whileInView={reduceMotion ? undefined : "visible"}
      viewport={{ ...MOTION.viewport, amount }}
      transition={{ duration: reduceMotion ? 0 : MOTION.duration.enter, ease: MOTION.ease, delay }}
    >
      {children}
    </MotionTag>
  );
}

/**
 * Backwards-compatible alias used across the existing pages.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <MotionInView className={className} delay={delay}>
      {children}
    </MotionInView>
  );
}

/**
 * Parent for staggered card/list entrances. Children should use `MotionItem`.
 */
export function MotionGroup({
  children,
  className,
  stagger = MOTION.stagger,
  delay = 0,
  amount = MOTION.viewport.amount,
  style,
  as = "div",
  ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
  amount?: number;
  style?: CSSProperties;
  as?: "div" | "section" | "article" | "aside";
  ariaLabel?: string;
}) {
  const reduceMotion = useReducedMotion();
  const MotionTag = motion[as] as typeof motion.div;

  return (
    <MotionTag
      data-motion="group"
      className={className}
      style={style}
      aria-label={ariaLabel}
      initial={reduceMotion ? false : "hidden"}
      whileInView={reduceMotion ? undefined : "visible"}
      viewport={{ ...MOTION.viewport, amount }}
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: reduceMotion ? 0 : stagger, delayChildren: delay },
        },
      }}
    >
      {children}
    </MotionTag>
  );
}

export function MotionItem({
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
    <motion.div
      data-motion="item"
      className={className}
      style={style}
      variants={reduceMotion ? undefined : fadeUpSmall}
      transition={{ duration: reduceMotion ? 0 : MOTION.duration.fast, ease: MOTION.ease }}
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
      data-motion="card"
      className={className}
      style={style}
      variants={reduceMotion ? undefined : fadeUpSmall}
      whileHover={reduceMotion ? undefined : { y: -4 }}
      whileTap={reduceMotion ? undefined : { scale: 0.995 }}
      transition={{
        duration: reduceMotion ? 0 : MOTION.duration.fast,
        ease: MOTION.ease,
      }}
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
