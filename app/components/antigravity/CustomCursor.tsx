"use client";

import { useEffect, useState } from "react";

/**
 * Google Antigravity custom magnetic pointer follower.
 * Features smooth trailing, target expansion on interactive elements,
 * and automatic touch device / reduced-motion suppression.
 */
export default function CustomCursor() {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [isTouch, setIsTouch] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Suppress on touch devices and reduced motion
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (touch || reduced) return;

    setIsTouch(false);

    let currentX = -100;
    let currentY = -100;
    let targetX = -100;
    let targetY = -100;
    let rafId: number;

    const onMouseMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!visible) setVisible(true);
    };

    const onMouseLeave = () => setVisible(false);
    const onMouseEnter = () => setVisible(true);

    const onPointerOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const isInteractive = target.closest("button, a, input, [role='tab'], [role='button'], .is-interactive, [data-interactive]");
      setHovered(!!isInteractive);
    };

    const loop = () => {
      // Smooth interpolation
      currentX += (targetX - currentX) * 0.18;
      currentY += (targetY - currentY) * 0.18;
      setPos({ x: currentX, y: currentY });
      rafId = requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mouseover", onPointerOver, { passive: true });
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseover", onPointerOver);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
    };
  }, [visible]);

  if (isTouch || !visible) return null;

  return (
    <div
      className="fixed pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 rounded-full transition-[width,height,background-color,border-color] duration-200 ease-out hidden md:block"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: hovered ? "48px" : "18px",
        height: hovered ? "48px" : "18px",
        backgroundColor: hovered ? "rgba(66, 133, 244, 0.12)" : "rgba(18, 19, 23, 0.15)",
        border: hovered ? "1.5px solid rgba(66, 133, 244, 0.6)" : "1px solid rgba(18, 19, 23, 0.35)",
        backdropFilter: hovered ? "blur(4px)" : "none",
      }}
    />
  );
}
