"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  ph: number;
  am: number;
  sp: number;
  c: string;
}

const COLS = ["#3b6ff5", "#d64545", "#e8a317", "#2fa36b"];

export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    const mouse = { x: -999, y: -999 };
    let lastTime: number | null = null;
    let animationFrameId: number;

    const R = (a: number, b: number) => a + Math.random() * (b - a);

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      particles = [];
      const count = Math.min(260, Math.floor((width * height) / 4500));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: R(0, width),
          y: R(0, height),
          vx: R(-24, 24),
          vy: R(-24, 24),
          r: R(1.8, 4.8),
          ph: R(0, 6.28),
          am: R(12, 44),
          sp: R(0.6, 2),
          c: COLS[i % COLS.length],
        });
      }
    };

    const draw = (t: number) => {
      const dt = lastTime === null ? 0 : Math.min(50, t - lastTime) / 1000;
      lastTime = t;

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (p.x < -20) p.x = width + 20;
        else if (p.x > width + 20) p.x = -20;

        if (p.y < -20) p.y = height + 20;
        else if (p.y > height + 20) p.y = -20;

        const px = p.x + Math.cos((t / 1000) * p.sp + p.ph) * p.am;
        const py = p.y + Math.sin((t / 1300) * p.sp + p.ph) * p.am;

        const dx = px - mouse.x;
        const dy = py - mouse.y;
        const dist = Math.hypot(dx, dy) || 1;
        const k = dist < 120 ? 1 - dist / 120 : 0;

        const renderX = px + (dx / dist) * k * 14;
        const renderY = py + (dy / dist) * k * 14;

        ctx.fillStyle = p.c;
        ctx.globalAlpha = 0.5 + 0.35 * Math.sin((t / 900) * p.sp + p.ph);
        ctx.beginPath();
        ctx.arc(renderX, renderY, p.r * (1 + k * 0.3), 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.touches[0].clientX - rect.left;
        mouse.y = e.touches[0].clientY - rect.top;
      }
    };

    const handleMouseLeave = () => {
      mouse.x = -999;
      mouse.y = -999;
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleMouseLeave);
    window.addEventListener("mouseleave", handleMouseLeave);

    handleResize();
    animationFrameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleMouseLeave);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return <canvas id="fx" ref={canvasRef} aria-hidden="true" />;
}
