"use client";

import { useState, useEffect } from "react";

const VERSES = [
  ["الرَّبُّ رَاعِيَّ فَلاَ يُعْوِزُنِي شَيْءٌ.", "مزمور ٢٣: ١"],
  ["لأَنَّهُ هكَذَا أَحَبَّ اللهُ الْعَالَمَ حَتَّى بَذَلَ ابْنَهُ الْوَحِيدَ، لِكَيْ لاَ يَهْلِكَ كُلُّ مَنْ يُؤْمِنُ بِهِ، بَلْ تَكُونُ لَهُ الْحَيَاةُ الأَبَدِيَّةُ.", "يوحنا ٣: ١٦"],
  ["أَسْتَطِيعُ كُلَّ شَيْءٍ فِي الْمَسِيحِ الَّذِي يُقَوِّينِي.", "فيلبي ٤: ١٣"],
  ["تَعَالَوْا إِلَيَّ يَا جَمِيعَ الْمُتْعَبِينَ وَالثَّقِيلِي الأَحْمَالِ وَأَنَا أُرِيحُكُمْ.", "متى ١١: ٢٨"],
  ["ذُوقُوا وَانْظُرُوا مَا أَطْيَبَ الرَّبَّ.", "مزمور ٣٤: ٨"],
  ["لاَ تَخَفْ لأَنِّي مَعَكَ.", "إشعياء ٤١: ١٠"],
  ["أَنَا أُحِبُّ الَّذِينَ يُحِبُّونَنِي، وَالَّذِينَ يُبَكِّرُونَ إِلَيَّ يَجِدُونَنِي.", "أمثال ٨: ١٧"],
];

export default function BibleWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(new Date().getDate() % VERSES.length);
  }, []);

  const nextVerse = () => {
    setIndex((prev) => (prev + 1) % VERSES.length);
  };

  return (
    <>
      <button
        type="button"
        className="fab"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="الكتاب المقدس"
        aria-expanded={isOpen}
      >
        <span className="fr"></span>
        <span className="fi" aria-hidden="true">📖</span>
        <span className="fl">الكتاب المقدس</span>
      </button>

      {isOpen && (
        <aside className="bib" role="dialog" aria-label="الكتاب المقدس">
          <div className="bh">
            <b className="text-lg">📖 الكتاب المقدس</b>
            <button
              type="button"
              className="ib text-sm"
              onClick={() => setIsOpen(false)}
              aria-label="إغلاق"
            >
              ✕
            </button>
          </div>

          <div className="bv">
            <small className="block mb-1">آية اليوم</small>
            <p className="font-medium text-slate-800 dark:text-slate-100">«{VERSES[index][0]}»</p>
            <span className="block mt-2 font-bold text-blue-600 dark:text-blue-400">{VERSES[index][1]}</span>
          </div>

          <div className="row2 mb-3">
            <button
              type="button"
              className="btn ghost sm"
              onClick={nextVerse}
            >
              آية تانية
            </button>
          </div>

          <a
            className="btn big w-full text-center"
            href="https://www.agiosbible.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            افتح الكتاب المقدس ↗
          </a>
          <p className="hint text-center">بيفتح موقع agiosbible.com في نافذة جديدة.</p>
        </aside>
      )}
    </>
  );
}
