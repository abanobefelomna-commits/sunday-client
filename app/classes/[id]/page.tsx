"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Eye, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import AppHeader from "../../components/AppHeader";
import BottomNav from "../../components/BottomNav";
import {
  canManageClass,
  getClass,
  getStoredUser,
  type AuthUser,
  type ClassItem,
} from "../../lib/api";
import { SERVICE_ROLE_KEYS } from "../../lib/format";
import { useI18n } from "../../lib/app-i18n";

export default function ClassDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useI18n();
  const [classData, setClassData] = useState<ClassItem | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.resolve().then(() => setCurrentUser(getStoredUser()));
    getClass(id)
      .then((data) => setClassData(data))
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : t("classDetail.loadError")))
      .finally(() => setLoading(false));
  }, [id, t]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
        <AppHeader />
        <div className="pg text-center py-20 text-slate-400">{t("classDetail.loading")}</div>
        <BottomNav />
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
        <AppHeader />
        <div className="pg text-center py-20">
          <h2 className="text-xl font-bold mb-4">{t("classDetail.notFound")}</h2>
          <Link href="/classes" className="btn">
            {t("classDetail.backAll")}
          </Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  const children = classData.children || [];
  const servants = classData.servants || [];
  const canManage = canManageClass(currentUser, classData.id);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
      <AppHeader />

      <main className="pg">
        <Link href="/classes" className="hint inline-block mb-1">
          ← {t("classDetail.backAll")}
        </Link>

        {/* Cover Header */}
        <div className="cover bg-gradient-to-tr from-blue-700 to-indigo-500 min-h-44 rounded-3xl p-6 text-white flex flex-col justify-end shadow-xl">
          <small className="opacity-80">
            {classData.grade === "general" ? t("classDetail.general") : t("classDetail.serviceClass")}
          </small>
          <h1 className="text-3xl font-extrabold mt-1">{classData.name}</h1>
          <p className="text-sm opacity-90 mt-1">{t("classDetail.academicYear", { year: classData.academicYear })}</p>
          {classData.description && <p className="text-sm opacity-90 mt-1">{classData.description}</p>}
        </div>

        {canManage ? (
          <div className="flex gap-3">
            <Link
              href={`/attendance?classId=${classData.id}`}
              className="btn big flex-1 text-center"
            >
              ✅ {t("classDetail.recordAttendance")}
            </Link>
          </div>
        ) : (
          <div className="notice">
            <Eye size={18} aria-hidden="true" />
            <span>
              {t("classDetail.readOnly")}
            </span>
          </div>
        )}

        {/* Children List in this Class */}
        <div className="card">
          <div className="ch">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {t("classDetail.childrenTitle", { count: children.length })}
            </h3>
            {canManage ? (
              <Link
                href="/children"
                className="text-sm text-blue-600 dark:text-blue-400 font-bold"
              >
                {t("classDetail.addChild")}
              </Link>
            ) : (
              <span className="text-xs text-slate-400 inline-flex items-center gap-1">
                <LockKeyhole size={13} aria-hidden="true" /> {t("common.viewOnly")}
              </span>
            )}
          </div>

          {children.length > 0 ? (
            children.map((c) => (
              <div key={c.id} className="row">
                <b className="text-slate-900 dark:text-slate-100">{c.name}</b>
                {c.phone ? (
                  <a
                    href={`tel:${c.phone}`}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    dir="ltr"
                  >
                    {c.phone}
                  </a>
                ) : (
                  <span className="text-xs text-slate-400">{t("classDetail.phoneMissing")}</span>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-slate-400">
              {t("classDetail.noChildren")}
            </div>
          )}
        </div>

        {/* Servants in this Class */}
        <div className="card">
          <div className="ch">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {t("classDetail.servantsTitle", { count: servants.length })}
            </h3>
            <Link
              href="/servants"
              className="text-sm text-blue-600 dark:text-blue-400 font-bold"
            >
              {t("classDetail.servantsDirectory")}
            </Link>
          </div>

          {servants.length > 0 ? (
            servants.map((s) => {
              const isLeader = s.role === "قائد فصل";
              return (
                <div
                  key={s.id}
                  className={`row ${
                    isLeader
                      ? "rounded-2xl border-2 border-amber-400 bg-amber-50/70 px-4 dark:bg-amber-950/20"
                      : ""
                  }`}
                >
                  <div>
                    <b className="text-slate-900 dark:text-slate-100">{s.name}</b>
                    {s.role && (
                      <span
                        className={`block text-xs font-bold ${
                          isLeader ? "text-amber-700 dark:text-amber-300" : "text-slate-500"
                        }`}
                      >
                        {SERVICE_ROLE_KEYS[s.role] ? t(SERVICE_ROLE_KEYS[s.role] as Parameters<typeof t>[0]) : s.role}
                      </span>
                    )}
                  </div>
                  {s.phone ? (
                    <a
                      href={`tel:${s.phone}`}
                      className="text-sm text-amber-600 dark:text-amber-400 hover:underline"
                      dir="ltr"
                    >
                      {s.phone}
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">{t("classDetail.phoneMissing")}</span>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-slate-400">
              {t("classDetail.noServants")}
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
