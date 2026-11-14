"use client";

import { useState, useEffect } from "react";
import { useI18n } from "../lib/app-i18n";

const VERSE_KEYS = [1, 2, 3, 4, 5, 6, 7] as const;

export default function BibleWidget() {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(new Date().getDate() % VERSE_KEYS.length);
  }, []);

  const nextVerse = () => {
    setIndex((prev) => (prev + 1) % VERSE_KEYS.length);
  };

  const verseNumber = VERSE_KEYS[index];

  return (
    <>
      <button
        type="button"
        className="fab"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t("bible.button")}
        aria-expanded={isOpen}
      >
        <span className="fr"></span>
        <span className="fi" aria-hidden="true">📖</span>
        <span className="fl">{t("bible.button")}</span>
      </button>

      {isOpen && (
        <aside className="bib" role="dialog" aria-label={t("bible.button")}>
          <div className="bh">
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
    </>
  );
}
