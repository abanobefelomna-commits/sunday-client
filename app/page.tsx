"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import HeroCanvas from "./components/HeroCanvas";
import ThemeToggle from "./components/ThemeToggle";
import { getStoredToken } from "./lib/api";

export default function LandingPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!getStoredToken());
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 3);
    }, 4200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative min-h-screen">
      {/* Floating Header Navigation Pill */}
      <header className="nav">
        <nav className="pill" aria-label="التنقل الرئيسي">
          <Link className="brand" href="/">
            ✝ مدارس الأحد
          </Link>
          <a className="l" href="#idea">
            الفكرة
          </a>
          {isLoggedIn ? (
            <Link className="btn" href="/dashboard">
              افتح التطبيق
            </Link>
          ) : (
            <>
              <Link className="l" href="/login">
                دخول
              </Link>
              <Link className="btn" href="/register">
                حساب جديد
              </Link>
            </>
          )}
          <ThemeToggle />
        </nav>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <HeroCanvas />

        <div className="in">
          <h1 className="hero-title">مدارس الأحد</h1>
          <p className="sub">
            مكان لأولادنا في المرحلة الابتدائية، نتعلّم فيه كلمة الله ونكبر معًا في المحبة.
          </p>

          <div className="cta">
            <Link className="btn big" href="/register">
              إنشاء حساب خادم
            </Link>
            <Link className="btn big ghost" href="/login">
              تسجيل الدخول
            </Link>
          </div>

          <p className="bless">بفضل ربنا يسوع وبقوة صليبه ✝</p>
        </div>
      </section>

      {/* Interactive Walkthrough Demo */}
      <section className="s" id="idea">
        <div className="split">
          <div>
            <h2>إزاي تستخدم التطبيق؟</h2>
            <p className="lead">
              خطوات سريعة توضّح لك إزاي تبدأ من أول التسجيل لحد تسجيل ومتابعة الحضور.
            </p>

            <ul className="pts">
              <li>
                <i style={{ background: "#3b6ff5" }}></i>
                <div>
                  <b>أنشئ حسابك</b>
                  <span>اكتب اسمك واختار المرحلة أو السنة اللي بتخدم فيها.</span>
                </div>
              </li>
              <li>
                <i style={{ background: "#2fa36b" }}></i>
                <div>
                  <b>سجّل الحضور</b>
                  <span>دوس حاضر أو غايب لكل طفل في ثانية واحدة.</span>
                </div>
              </li>
              <li>
                <i style={{ background: "#e8a317" }}></i>
                <div>
                  <b>تابع اللوحة</b>
                  <span>شوف عدد الأطفال، نسب الحضور، والافتقاد من مكان واحد.</span>
                </div>
              </li>
            </ul>
          </div>

          <div className="demo">
            <div className="phone" aria-label="تجربة توضيحية للتطبيق">
              {/* Screen 1: Servant Account */}
              <div className={`scr ${activeStep === 0 ? "on" : ""}`}>
                <small>الخطوة ١ — حساب الخادم</small>
                <div className="mf">أ. مينا سامي</div>
                <div className="mf">سنة ثالثة ابتدائي</div>
                <div className="mf">mina@church.org</div>
                <b className="okb">تم إنشاء الحساب بنجاح ✓</b>
              </div>

              {/* Screen 2: Attendance Marking */}
              <div className={`scr ${activeStep === 1 ? "on" : ""}`}>
                <small>الخطوة ٢ — سجل الحضور</small>
                <div className="file">
                  <span>مينا جورج</span>
                  <span className="tg g">
                    <b>حاضر</b>
                  </span>
                </div>
                <div className="file">
                  <span>مريم سمير</span>
                  <span className="tg g">
                    <b>حاضر</b>
                  </span>
                </div>
                <div className="file">
                  <span>كيرلس مجدي</span>
                  <span className="tg g">
                    <b>حاضر</b>
                  </span>
                </div>
                <div className="file">
                  <span>مارينا عادل</span>
                  <span className="tg">
                    <b>غايب</b>
                  </span>
                </div>
              </div>

              {/* Screen 3: Stats Dashboard */}
              <div className={`scr ${activeStep === 2 ? "on" : ""}`}>
                <small>الخطوة ٣ — المتابعة والنسب</small>
                <div className="big3">
                  <div>
                    <b>٢٤</b>
                    طفل بالفصل
                  </div>
                  <div>
                    <b>٢١</b>
                    حاضر اليوم
                  </div>
                </div>
                <div className="bars">
                  <i style={{ ["--h" as string]: "65%" }}></i>
                  <i style={{ ["--h" as string]: "85%" }}></i>
                  <i style={{ ["--h" as string]: "75%" }}></i>
                  <i style={{ ["--h" as string]: "92%" }}></i>
                </div>
                <small className="text-slate-400">حضور آخر ٤ أسابيع</small>
              </div>
            </div>

            {/* Step Tabs */}
            <div className="tabs" role="tablist">
              <button
                role="tab"
                aria-selected={activeStep === 0}
                onClick={() => setActiveStep(0)}
              >
                <i></i>١ الحساب
              </button>
              <button
                role="tab"
                aria-selected={activeStep === 1}
                onClick={() => setActiveStep(1)}
              >
                <i></i>٢ الحضور
              </button>
              <button
                role="tab"
                aria-selected={activeStep === 2}
                onClick={() => setActiveStep(2)}
              >
                <i></i>٣ المتابعة
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Ready to start CTA band */}
      <section className="s" id="primary">
        <div className="panel">
          <div>
            <h2>جاهز تبدأ الخدمة؟</h2>
            <p>
              أنشئ حساب خادم، واختار مرحلتك وفصلك، وابدأ متابعة أطفالك في دقيقة واحدة.
            </p>
          </div>
          <div className="row2">
            <Link className="btn big" href="/register">
              إنشاء حساب خادم
            </Link>
            <Link className="btn big ghost" href="/login">
              تسجيل الدخول
            </Link>
          </div>
        </div>
      </section>

      <footer className="text-center text-slate-400 py-10 text-sm">
        © مدارس الأحد — كنيسة السيدة العذراء مريم
      </footer>
    </div>
  );
}
