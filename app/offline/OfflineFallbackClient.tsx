"use client";

import Link from "next/link";
import { useI18n } from "../lib/app-i18n";

export default function OfflineFallbackClient() {
  const { t, direction } = useI18n();

  return (
    <main
      dir={direction}
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f6f7fb",
        fontFamily: "var(--font-cairo), system-ui, sans-serif",
      }}
    >
      <section
        style={{
          maxWidth: 420,
          width: "100%",
          background: "#fff",
          border: "1px solid #e3e6f0",
          borderRadius: 24,
          padding: 28,
          textAlign: "center",
          boxShadow: "0 18px 40px -30px rgba(30,42,90,.45)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 72,
            height: 72,
            margin: "0 auto 16px",
            borderRadius: 22,
            background: "#eef1fb",
            display: "grid",
            placeItems: "center",
            fontSize: 34,
          }}
        >
          📶
        </div>
        <h1 style={{ fontSize: 22, margin: "0 0 10px", color: "#1e2a5a" }}>
          {t("offline.page.title")}
        </h1>
        <p style={{ margin: "0 0 18px", color: "#5a6480", lineHeight: 1.9, fontSize: 15 }}>
          {t("offline.page.body")}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/attendance"
            style={{
              background: "#1e2a5a",
              color: "#fff",
              padding: "12px 20px",
              borderRadius: 14,
              fontWeight: 700,
              textDecoration: "none",
              minHeight: 48,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            {t("offline.page.openAttendance")}
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: "#eef1fb",
              color: "#1e2a5a",
              padding: "12px 20px",
              borderRadius: 14,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              minHeight: 48,
              display: "inline-flex",
              alignItems: "center",
              fontFamily: "inherit",
            }}
          >
            {t("offline.bar.retry")}
          </button>
        </div>
      </section>
    </main>
  );
}
