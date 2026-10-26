"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem("ss2.t") as "light" | "dark" | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.dataset.theme = saved;
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initial = prefersDark ? "dark" : "light";
      setTheme(initial);
      document.documentElement.dataset.theme = initial;
    }
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("ss2.t", next);
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="ib"
      aria-label="تبديل الوضع الليلي"
      title="تبديل الوضع الليلي"
    >
      {theme === "dark" ? "☀️" : "◐"}
    </button>
  );
}
