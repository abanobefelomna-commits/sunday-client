"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  Check,
  ChevronDown,
  Church,
  CircleHelp,
  ClipboardCheck,
  Globe2,
  Headphones,
  HeartHandshake,
  Languages,
  LockKeyhole,
  Menu,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import {
  localeLabels,
  supportedLocales,
  type LandingMessages,
  type Locale,
} from "./messages";
import { sharedPublicCopy } from "./shared-copy";
import { usePublicLocale } from "./use-public-locale";

function PublicHeader({
  locale,
  messages,
  onLocaleChange,
}: {
  locale: Locale;
  messages: LandingMessages;
  onLocaleChange: (value: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);
  return (
    <header className={"ps-header"}>
      <div className={"ps-headerInner"}>
        <Link className={"ps-brand"} href="/" aria-label={messages.name} onClick={closeMenu}>
          <span className={"ps-brandMark"} aria-hidden="true"><Church size={23} strokeWidth={2.1} /></span>
          <span>{messages.name}<small>Sunday School</small></span>
        </Link>

        <button
          className={"ps-menuToggle"}
          type="button"
          aria-label={menuOpen ? messages.closeMenu : messages.menu}
          aria-expanded={menuOpen}
          aria-controls="public-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <nav id="public-navigation" className={`${"ps-navigation"} ${menuOpen ? "ps-navigationOpen" : ""}`} aria-label={messages.name}>
          <Link href="#home" onClick={closeMenu}>{messages.nav.home}</Link>
          <Link href="#features" onClick={closeMenu}>{messages.nav.features}</Link>
          <Link href="#how-it-works" onClick={closeMenu}>{messages.nav.how}</Link>
          <Link href="/churches" onClick={closeMenu}>{messages.nav.churches}</Link>
          <Link href="#faq" onClick={closeMenu}>{messages.nav.faq}</Link>
          <Link href="#contact" onClick={closeMenu}>{messages.nav.contact}</Link>
          <div className={"ps-mobileActions"}>
            <Link className={"ps-loginButton"} href="/login" onClick={closeMenu}>{messages.login}</Link>
            <Link className={"ps-primaryButton"} href="/register/church" onClick={closeMenu}>{messages.start}<ArrowUpRight size={17} /></Link>
          </div>
        </nav>

        <div className={"ps-headerActions"}>
          <label className={"ps-languagePicker"}>
            <Globe2 aria-hidden="true" size={17} />
            <span className={"ps-srOnly"}>{messages.language}</span>
            <select value={locale} aria-label={messages.language} onChange={(event) => onLocaleChange(event.target.value)}>
              {supportedLocales.map((code) => <option key={code} value={code}>{localeLabels[code]}</option>)}
            </select>
            <ChevronDown aria-hidden="true" size={15} />
          </label>
          <Link className={"ps-loginButton"} href="/login">{messages.login}</Link>
          <Link className={`${"ps-primaryButton"} ${"ps-headerCta"}`} href="/register/church">{messages.start}<ArrowUpRight size={17} /></Link>
        </div>
      </div>
    </header>
  );
}

function BenefitsStrip({ messages }: { messages: LandingMessages }) {
  const icons = [ShieldCheck, Languages, Sparkles, Headphones, HeartHandshake];
  return (
    <section className={"ps-benefits"} aria-label={messages.heroNote}>
      {messages.benefits.map((benefit, index) => {
        const Icon = icons[index];
        return <div className={"ps-benefit"} key={benefit.title}>
          <span className={"ps-benefitIcon"}><Icon size={21} strokeWidth={1.9} aria-hidden="true" /></span>
          <span><strong>{benefit.title}</strong><small>{benefit.text}</small></span>
        </div>;
      })}
    </section>
  );
}

function ProductPreview({ messages }: { messages: LandingMessages }) {
  const icons = [UsersRound, BookOpenCheck, ClipboardCheck, HeartHandshake];
  return (
    <div className={"ps-productFrame"} aria-label={messages.demoLabel}>
      <div className={"ps-productTopbar"}>
        <div className={"ps-productBrand"}><span><Church size={15} /></span>{messages.dashboardTitle}</div>
        <div className={"ps-productTopMeta"}><span className={"ps-productAvatar"}>م</span><span>{messages.dashboardCaption}</span></div>
      </div>
      <div className={"ps-productBody"}>
        <aside className={"ps-productSidebar"} aria-hidden="true">
          <div className={`${"ps-fakeNav"} ${"ps-fakeNavActive"}`}><BarChart3 size={15} />{messages.nav.home}</div>
          <div className={"ps-fakeNav"}><UsersRound size={15} />{messages.demoItems[0]}</div>
          <div className={"ps-fakeNav"}><BookOpenCheck size={15} />{messages.demoItems[1]}</div>
          <div className={"ps-fakeNav"}><ClipboardCheck size={15} />{messages.demoItems[2]}</div>
        </aside>
        <div className={"ps-productContent"}>
          <div className={"ps-productHeading"}><span>{messages.dashboardCaption}</span><small>{messages.sample}</small></div>
          <div className={"ps-metricGrid"}>
            {messages.demoItems.map((item, index) => {
              const Icon = icons[index];
              return <div className={"ps-metricCard"} key={item}>
                <span className={"ps-metricIcon"}><Icon size={18} /></span>
                <small>{item}</small>
                <strong>{messages.demo}</strong>
              </div>;
            })}
          </div>
          <div className={"ps-previewLower"}>
            <div className={"ps-previewList"}>
              <strong>{messages.dashboardTitle}</strong>
              {messages.showcasePoints.slice(0, 3).map((point) => <span key={point}><Check size={14} />{point}</span>)}
            </div>
            <div className={"ps-previewChart"} aria-hidden="true">
              <div className={"ps-chartTitle"}><span>{messages.nav.features}</span><span>{messages.sample}</span></div>
              <div className={"ps-chartBars"}>{[42, 66, 52, 84, 61, 74, 91, 68, 82, 58].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
              <div className={"ps-chartCaption"}>{messages.demoLabel}</div>
            </div>
          </div>
        </div>
      </div>
      <div className={"ps-demoWatermark"}><ShieldCheck size={14} />{messages.demoLabel}</div>
    </div>
  );
}

function PublicFooter({ messages }: { messages: LandingMessages }) {
  return (
    <footer className={"ps-footer"}>
      <div className={"ps-footerMain"}>
        <Link href="/" className={"ps-brand"}>
          <span className={"ps-brandMark"} aria-hidden="true"><Church size={23} /></span>
          <span>{messages.name}<small>Sunday School</small></span>
        </Link>
        <p>{messages.footerText}</p>
        <nav aria-label={messages.nav.contact} className={"ps-footerLinks"}>
          <Link href="#features">{messages.nav.features}</Link>
          <Link href="/churches">{messages.nav.churches}</Link>
          <Link href="#faq">{messages.nav.faq}</Link>
          <Link href="/privacy">{messages.privacy}</Link>
          <Link href="/terms">{messages.terms}</Link>
          <Link href="/login">{messages.login}</Link>
        </nav>
      </div>
      <div className={"ps-footerBottom"}><span>{messages.name}</span><span>{messages.contactStatus}</span></div>
    </footer>
  );
}

export default function PublicLanding() {
  const { locale, direction, messages, setLocale: changeLocale } = usePublicLocale();
  const sharedCopy = sharedPublicCopy[locale];

  const featureIcons = [UsersRound, BookOpenCheck, ClipboardCheck, BarChart3, Church, Globe2];

  return (
    <div className={"ps-publicSite"} dir={direction}>
      <a className={"ps-skipLink"} href="#main-content">{sharedCopy.skipToContent}</a>
      <PublicHeader locale={locale} messages={messages} onLocaleChange={changeLocale} />
      <main id="main-content">
        <section className={"ps-hero"} id="home">
          <div className={"ps-heroGlow"} aria-hidden="true" />
          <div className={"ps-heroInner"}>
            <div className={"ps-heroCopy"}>
              <span className={"ps-eyebrow"}><Sparkles size={15} />{messages.heroEyebrow}</span>
              <h1>{messages.heroTitle}</h1>
              <p className={"ps-heroLead"}>{messages.heroLead}</p>
              <div className={"ps-heroActions"}>
                <Link className={"ps-primaryButton"} href="/register/church">{messages.heroStart}<ArrowUpRight size={18} /></Link>
                <a className={"ps-secondaryButton"} href="#showcase">{messages.heroExplore}<ArrowDown size={17} /></a>
              </div>
              <p className={"ps-heroNote"}><HeartHandshake size={17} />{messages.heroNote}</p>
            </div>
            <div className={"ps-heroVisual"}>
              <div className={"ps-heroImageWrap"}>
                <Image
                  src="/images/public-hero-illustration.jpg"
                  alt={sharedCopy.heroImageAlt}
                  fill
                  priority
                  sizes="(max-width: 760px) 100vw, 58vw"
                  className={"ps-heroImage"}
                />
              </div>
              <div className={"ps-heroImageCaption"}><span><Church size={16} /></span><div><strong>{messages.name}</strong><small>{messages.demo}</small></div></div>
              <span className={"ps-heroSparkle"} aria-hidden="true"><Sparkles size={25} /></span>
            </div>
          </div>
        </section>

        <div className={"ps-benefitsWrap"}><BenefitsStrip messages={messages} /></div>

        <section className={`${"ps-section"} ${"ps-showcase"}`} id="showcase">
          <div className={"ps-showcaseGrid"}>
            <div className={"ps-showcaseVisual"}><ProductPreview messages={messages} /></div>
            <div className={"ps-sectionCopy"}>
              <span className={"ps-sectionEyebrow"}><Sparkles size={15} />{messages.showcaseEyebrow}</span>
              <h2>{messages.showcaseTitle}</h2>
              <p>{messages.showcaseLead}</p>
              <ul className={"ps-checkList"}>{messages.showcasePoints.map((point) => <li key={point}><Check size={16} />{point}</li>)}</ul>
              <Link className={"ps-primaryButton"} href="/register/church">{messages.start}<ArrowUpRight size={17} /></Link>
            </div>
          </div>
        </section>

        <section className={`${"ps-section"} ${"ps-featuresSection"}`} id="features">
          <div className={"ps-sectionHeading"}>
            <span className={"ps-sectionEyebrow"}><Sparkles size={15} />{messages.featuresEyebrow}</span>
            <h2>{messages.featuresTitle}</h2><p>{messages.featuresLead}</p>
          </div>
          <div className={"ps-featureGrid"}>
            {messages.features.map((feature, index) => {
              const Icon = featureIcons[index];
              const available = feature.status === "available";
              return <article className={"ps-featureCard"} key={feature.title}>
                <span className={`${"ps-featureIcon"} ${available ? "ps-featureIconAvailable" : "ps-featureIconPlanned"}`}><Icon size={22} /></span>
                <span className={`${"ps-statusPill"} ${available ? "ps-statusAvailable" : "ps-statusPlanned"}`}>{available ? messages.available : messages.planned}</span>
                <h3>{feature.title}</h3><p>{feature.text}</p>
              </article>;
            })}
          </div>
        </section>

        <section className={`${"ps-section"} ${"ps-howSection"}`} id="how-it-works">
          <div className={"ps-sectionHeading"}>
            <span className={"ps-sectionEyebrow"}><ArrowUpRight size={15} />{messages.howEyebrow}</span>
            <h2>{messages.howTitle}</h2><p>{messages.howLead}</p>
          </div>
          <ol className={"ps-stepsGrid"}>
            {messages.steps.map((step, index) => <li className={"ps-stepCard"} key={step.title}>
              <span className={"ps-stepNumber"}>{new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false }).format(index + 1)}</span>
              {index === 1 ? <LockKeyhole className={"ps-stepIcon"} size={20} /> : index === 3 ? <ShieldCheck className={"ps-stepIcon"} size={20} /> : <UsersRound className={"ps-stepIcon"} size={20} />}
              <h3>{step.title}</h3><p>{step.text}</p>
            </li>)}
          </ol>
        </section>

        <section className={`${"ps-section"} ${"ps-discoverySection"}`} id="churches">
          <div className={"ps-discoveryCard"}>
            <div className={"ps-discoveryArt"} aria-hidden="true">
              <span className={"ps-discoverySun"} />
              <span className={"ps-discoveryCross"}>†</span>
              <span className={"ps-discoveryChurch"}><Church size={86} strokeWidth={1.1} /></span>
              <span className={"ps-discoveryCloud"} />
            </div>
            <div className={"ps-discoveryCopy"}>
              <span className={"ps-sectionEyebrow"}><Globe2 size={15} />{messages.directoryEyebrow}</span>
              <h2>{messages.directoryTitle}</h2><p>{messages.directoryLead}</p>
              <div className={"ps-discoveryActions"}>
                <Link className={"ps-primaryButton"} href="/churches">{messages.directoryAction}<ArrowUpRight size={17} /></Link>
                <Link className={"ps-secondaryButton"} href="/join">{messages.joinAction}<ArrowUpRight size={17} /></Link>
              </div>
              <p className={"ps-notice"}><CircleHelp size={17} />{messages.directoryNote}</p>
            </div>
          </div>
        </section>

        <section className={`${"ps-section"} ${"ps-previewSection"}`} id="preview">
          <div className={"ps-previewBanner"}>
            <span className={"ps-previewEmblem"}><HeartHandshake size={28} /></span>
            <div><span className={"ps-sectionEyebrow"}>{messages.previewEyebrow}</span><h2>{messages.previewTitle}</h2><p>{messages.previewBody}</p><p className={"ps-previewRule"}><Check size={17} />{messages.previewRule}</p></div>
            <Link className={"ps-lightButton"} href="/register/church">{messages.previewAction}<ArrowUpRight size={17} /></Link>
          </div>
        </section>

        <section className={`${"ps-section"} ${"ps-faqSection"}`} id="faq">
          <div className={"ps-sectionHeading"}>
            <span className={"ps-sectionEyebrow"}><CircleHelp size={15} />{messages.faqEyebrow}</span>
            <h2>{messages.faqTitle}</h2>
          </div>
          <div className={"ps-faqList"}>
            {messages.questions.map((item) => <details key={item.question} className={"ps-faqItem"}>
              <summary>{item.question}<ChevronDown size={19} aria-hidden="true" /></summary>
              <p>{item.answer}</p>
            </details>)}
          </div>
        </section>

        <section className={`${"ps-section"} ${"ps-contactSection"}`} id="contact">
          <div className={"ps-contactCard"}>
            <span className={"ps-contactIcon"}><Headphones size={23} /></span>
            <div><span className={"ps-sectionEyebrow"}>{messages.contactEyebrow}</span><h2>{messages.contactTitle}</h2><p>{messages.contactText}</p><small>{messages.contactStatus}</small></div>
            <Link className={"ps-secondaryButton"} href="#faq">{messages.nav.faq}<ArrowUpRight size={16} /></Link>
          </div>
        </section>
      </main>
      <PublicFooter messages={messages} />
    </div>
  );
}
