"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../lib/app-i18n";

const VERSE_KEYS = [1, 2, 3, 4, 5, 6, 7] as const;

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startOffset: { x: number; y: number };
  startRect: DOMRect;
};

const VIEWPORT_MARGIN = 8;

export default function BibleWidget() {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const draggedRef = useRef(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setIndex(new Date().getDate() % VERSE_KEYS.length);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const nextVerse = () => {
    setIndex((prev) => (prev + 1) % VERSE_KEYS.length);
  };

  const clampOffset = useCallback(
    (next: { x: number; y: number }) => {
      const root = rootRef.current;
      if (!root || typeof window === "undefined") return next;
      const rect = root.getBoundingClientRect();
      const maxX = Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.width - VIEWPORT_MARGIN);
      const maxY = Math.max(VIEWPORT_MARGIN, window.innerHeight - rect.height - VIEWPORT_MARGIN);
      const left = Math.min(Math.max(VIEWPORT_MARGIN, rect.left), maxX);
      const top = Math.min(Math.max(VIEWPORT_MARGIN, rect.top), maxY);
      return {
        x: next.x + (left - rect.left),
        y: next.y + (top - rect.top),
      };
    },
    [],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setOffset((current) => clampOffset(current));
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen, clampOffset]);

  useEffect(() => {
    const onResize = () => setOffset((current) => clampOffset(current));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampOffset]);

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const root = rootRef.current;
    if (!root) return;

    if (event.currentTarget.dataset.dragIgnore === "true") return;
    const target = event.target as HTMLElement;
    // Ignore interactive children (close button, links, inputs) but allow
    // dragging from the floating button itself and from the panel header.
    const interactive = target.closest("button, a, input, select, textarea");
    if (interactive && interactive !== event.currentTarget) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffset: offset,
      startRect: root.getBoundingClientRect(),
    };
    draggedRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      draggedRef.current = true;
    }

    const width = drag.startRect.width;
    const height = drag.startRect.height;
    const desiredLeft = drag.startRect.left + dx;
    const desiredTop = drag.startRect.top + dy;
    const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN);
    const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN);
    const left = Math.min(Math.max(VIEWPORT_MARGIN, desiredLeft), maxLeft);
    const top = Math.min(Math.max(VIEWPORT_MARGIN, desiredTop), maxTop);

    setOffset({
      x: drag.startOffset.x + (left - drag.startRect.left),
      y: drag.startOffset.y + (top - drag.startRect.top),
    });
    event.preventDefault();
  };

  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const toggleOpen = () => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    setIsOpen((current) => !current);
  };

  const verseNumber = VERSE_KEYS[index];

  return (
    <div
      ref={rootRef}
      className="bible-widget-root"
      style={{
        position: "fixed",
        insetInlineEnd: 20,
        bottom: "calc(90px + env(safe-area-inset-bottom, 0px))",
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 12,
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
        willChange: "transform",
        touchAction: "pan-y",
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {isOpen && (
        <aside
          className="bib"
          role="dialog"
          aria-label={t("bible.button")}
          style={{
            position: "relative",
            insetInlineEnd: "auto",
            bottom: "auto",
            touchAction: "auto",
          }}
        >
          <div
            className="bh"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{ touchAction: "none", cursor: "grab", userSelect: "none" }}
          >
            <b className="text-lg">📖 {t("bible.title")}</b>
            <button
              type="button"
              className="ib text-sm"
              onClick={() => setIsOpen(false)}
              aria-label={t("common.close")}
            >
              ✕
            </button>
          </div>

          <div className="bv">
            <small className="block mb-1">{t("bible.today")}</small>
            <p className="font-medium text-slate-800 dark:text-slate-100">
              «{t(`bible.verse${verseNumber}` as Parameters<typeof t>[0])}»
            </p>
            <span className="block mt-2 font-bold text-blue-600 dark:text-blue-400">
              {t(`bible.ref${verseNumber}` as Parameters<typeof t>[0])}
            </span>
          </div>

          <div className="row2 mb-3">
            <button
              type="button"
              className="btn ghost sm"
              onClick={nextVerse}
            >
              {t("bible.next")}
            </button>
          </div>

          <a
            className="btn big w-full text-center"
            href="https://www.agiosbible.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("bible.open")}
          </a>
          <p className="hint text-center">{t("bible.hint")}</p>
        </aside>
      )}

      <button
        type="button"
        className="fab"
        onClick={toggleOpen}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        aria-label={t("bible.button")}
        aria-expanded={isOpen}
        style={{
          position: "relative",
          insetInlineEnd: "auto",
          bottom: "auto",
          touchAction: "none",
          cursor: "grab",
          userSelect: "none",
        }}
      >
        <span className="fr"></span>
        <span className="fi" aria-hidden="true">📖</span>
        <span className="fl">{t("bible.button")}</span>
      </button>
    </div>
  );
}
