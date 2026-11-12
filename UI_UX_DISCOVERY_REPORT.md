# Sunday School UI/UX Discovery Report

**Audit date:** 12 November 2026  
**Scope:** Existing frontend structure and implemented screens, plus visual inspection at desktop and mobile widths. This is a discovery report, not an implementation plan for current functionality. Future product ideas are marked as proposals.

## Executive summary

The product is an Arabic-first Sunday School service-management application built with the Next.js App Router. Its current interface supports a church-specific operational workflow: servants sign in, manage children and classes, record attendance, follow pastoral follow-ups, review analytics and announcements, and maintain servant profiles. The core service has a coherent RTL foundation and several useful reusable data components, but its visual system is split between a dramatic dark marketing hero and a light, blue-led admin interface.

The current frontend does not present the planned multi-church SaaS experience. There are no visible church directory, church registration, invitation-code joining, membership approval, platform administrator, language-selection, or Preview-program screens. The repository contains platform and tenant server modules, but that is not evidence of corresponding user-facing flows. Keep those capabilities separate from the existing interface in any redesign concept.

**Recommended direction:** a calm, modern operations workspace with warm neutral surfaces, deep ink/navy text, a restrained blue primary action color, and small teal/terracotta accents. Preserve a clear church identity and human pastoral tone, while making multi-tenant context, role, and language visible and predictable.

## 1. Existing application structure

### Frontend architecture

- Next.js App Router, React client components, TypeScript. The package manifest reports Next.js 16.4.2 and React 19.3.0.
- Routes live under `app/`; route-specific API handlers also live under `app/api/`. Data access and formatting helpers are in `app/lib/`.
- `src/server/` contains authentication, access control, tenant routing/context, and platform services. Database schemas and migrations live under `db/`.
- Styling is a large global stylesheet in `app/globals.css`, Tailwind utility classes in JSX, and some inline styles. The package includes Tailwind 4, Lucide icons, Framer Motion, and Sonner; most observed page styling is CSS/utility based.
- The shared root layout sets `lang="ar"`, `dir="rtl"`, loads Cairo for Arabic and Latin, applies the global stylesheet, and mounts a global toast region and Bible widget.
- Operational screens are mostly client-rendered: pages load service data after mount, with per-page loading/error state and client-side interactions.

### Route inventory

| Route | Existing screen and purpose |
|---|---|
| `/` | Arabic product landing page with animated hero, a three-step interactive product walkthrough, and sign-in/register CTAs. |
| `/app` | Redirects to `/dashboard`. |
| `/login` | Servant/supervisor sign-in with username/email/phone and password. |
| `/register` | Servant account registration: name, role, grade, email, phone, password, optional avatar. The page says administrative role labels do not grant administrative permissions. |
| `/forgot-password` | Password recovery request. |
| `/verify-otp` | OTP verification/resend flow. |
| `/reset-password` | Password reset flow. |
| `/dashboard` | Service overview: student/attendance/follow-up metrics, attendance trend, care summary, latest news, and class summary. |
| `/children` | Child directory with search, class filter, pagination, and add/edit/delete affordances gated by class permissions. |
| `/children/[id]` | Child profile and care journey; related tabs/components cover profile, attendance, notes, progress, and visitations. |
| `/classes` | Class overview/cards, class summary and class-image upload/removal controls when permitted. |
| `/classes/[id]` | Class details, roster and servant context. |
| `/attendance` | Date/class attendance, present/absent/late/excused marking, bulk marking, recent sessions and export action. |
| `/servants` | Servant directory and servant management. |
| `/follow-ups` | Pastoral follow-up cases, filters, status/priority, rules and evaluation/create flows. |
| `/follow-ups/[id]` | A follow-up case detail and activity history. |
| `/analytics` | Attendance and service analytics, class comparisons and date controls. |
| `/friday-prep` | Friday preparation checklist/workflow. |
| `/news` | Service announcements/news, including publishing and image-related controls. |
| `/notifications` | In-app notifications, read state and notification preferences. |
| `/profile` | Servant profile, avatar, contact/grade details, and password change. |

There is no dedicated reservation page or reservation-specific route in the inspected frontend. Attendance is session/date-oriented; do not describe it as an existing reservation interface. There is also no visible church directory, church registration, invitation-code join, church membership approval, or platform-admin route.

### API and data families

The App Router API includes auth/login/register/recovery/OTP-related endpoints; children and child profile/notes/progress; classes and images; servants and avatars; attendance, bulk attendance, sessions, summaries and reports; analytics; follow-ups, rules, evaluation and activities; visitations; Friday preparation; news and images; notifications/preferences; and user profile/password/avatar operations. This inventory describes endpoint families, not a guarantee that each flow was successfully exercised against a live backend.

## 2. Current visual identity

### Color and theme

The service UI uses a light blue-gray canvas (`#f7f8fc`), dark navy text (`#14213d`), muted slate (`#5b6478`), pale borders (`#dfe3ee`), white cards, a saturated blue primary (`#3b6ff5`) and darker blue hover (`#2551c9`). A warm brown accent (`#c77a4b`) accompanies semantic teal/green, amber, red and violet states. The stylesheet defines a dark theme using `data-theme="dark"`, with a system dark-mode fallback; the authenticated header has a theme toggle persisted in local storage.

The landing page has a separate visual mode: near-black/navy full-viewport hero, blue/cyan/violet glow, a large white Arabic title, and animated canvas/shader visuals. Lower landing sections return to pale surfaces. This makes the marketing page visually memorable but weakens continuity with the operational product.

### Typography and layout

- Cairo is the global font, with Arabic and Latin subsets. The page base line-height is 1.8; headings use a heavier weight and responsive sizing.
- The visual style favors rounded pills, 12–30px radius cards, soft shadows, translucent/blurred surfaces, blue focus/active states, and generous spacing.
- Operational pages use centered constrained content, a page heading/action area, KPI cards, surfaces, lists, and two-column sections that collapse at smaller breakpoints.
- Icons come mainly from Lucide, alongside Unicode marks/emojis and the cross-based church mark. Some cards use decorative gradients and patterned covers.

### Shared UI inventory

`app/components/ui/index.tsx` provides `PageHeader`, `StatCard`, `Badge`, `EmptyState`, `SkeletonRows`, `SkeletonCards`, `ProgressRing`, `MiniBars`, `Timeline`, `Modal`, and `Notice`. Other shared elements include:

- `AppHeader`: brand, theme toggle, quick search/command palette, notifications, account/avatar menu and logout.
- `BottomNav`: responsive service navigation, active route state, a “more” sheet, and desktop sidebar treatment.
- `CommandPalette`: route search plus child/servant lookup.
- `BibleWidget`: fixed floating verse widget mounted globally.
- `HeroCanvas` and shader helper: animated landing-page visual.
- Sonner toast region, loading skeletons, inline messages, notices, dialogs, forms, tables, chips, tabs, badges, and empty states.

The global CSS defines the token palette and common patterns, but route CSS, utility classes and inline styles coexist. There is no strong documented component contract or evident centralized page-level design-system package.

## 3. Visual inspection and screenshots

The local server was started with the documented `npm.cmd run dev` command. Playwright was used to open the landing/auth routes and operational paths at approximately 1440px desktop and 390px mobile widths. No credentials were entered and no form was submitted. Dynamic service screens can depend on the browser’s existing stored session and backend data, so their populated state was not treated as synthetic or reproduced. The child screen inspection showed an API “request failed (500)” notice together with zero counts and an empty state; the actual populated child experience therefore remains unverified visually.

Screenshots captured by Playwright are in `.playwright-mcp/`:

| Route / viewport | Screenshot |
|---|---|
| `/` desktop, full page | `.playwright-mcp/page-2026-11-12T11-32-19-597Z.png` |
| `/` mobile, full page | `.playwright-mcp/page-2026-11-12T11-34-50-107Z.png` |
| `/` mobile, top viewport | `.playwright-mcp/page-2026-11-12T11-35-06-597Z.png` |
| `/login` desktop, full page | `.playwright-mcp/page-2026-11-12T11-32-28-991Z.png` |
| `/register` desktop, full page | `.playwright-mcp/page-2026-11-12T11-32-37-282Z.png` |
| `/register` mobile, full page | `.playwright-mcp/page-2026-11-12T11-33-04-827Z.png` |
| `/children` mobile, empty/error state | `.playwright-mcp/page-2026-11-12T11-33-59-684Z.png` |
| `/dashboard` desktop, full page | `.playwright-mcp/page-2026-11-12T11-34-27-467Z.png` |

The landing and auth screens rendered in Arabic RTL. The marketing walkthrough cycles through a servant signup mock, attendance marks, and a summary chart. The dashboard’s empty-state layout is visible at desktop, but its content can incorporate browser-session values; use source data structures rather than this screenshot as a synthetic-data reference. The live operational routes were opened, but only the child route received a detailed safe snapshot. No church or platform-administration screen was available to inspect.

## 4. UX findings and improvement opportunities

### Current strengths

- RTL is foundational rather than bolted on: root document direction, logical inset/padding properties, Arabic formatting and Cairo are used.
- Service navigation is consistently mounted across operational pages, with active-page indication and a mobile “more” sheet.
- The main service tasks are represented by dedicated pages and the reusable UI includes loading skeletons, empty states, status badges, notices and confirmation-oriented modal patterns.
- Attendance supports multiple statuses and batch actions; child records gather several pastoral/education-related facets in one profile.
- Reduced-motion preferences are handled for several animation families, and keyboard focus styling is defined for links/buttons.

### Problems to address in a redesign

1. **Two product identities.** The landing page is cinematic and dark while the service UI is pale and operational. Unify the brand system and use motion/illustration as accents rather than a second product theme.
2. **Registration assumes an existing church context.** The page creates a servant account and asks for a grade, but offers no church discovery, church code, join request, invitation code or church administrator path. Make the user’s first decision explicit: create/register a church, or join one.
3. **No tenant context in the shell.** The operational header and sidebar identify the product but show no church switcher, church code, tenant breadcrumb, membership state, or language picker. These become essential in a multi-church platform.
4. **One service navigation for mixed roles.** Servants, church administrators and platform administrators need different task priorities and permissions. Avoid presenting the current single service menu as a complete multi-role information architecture.
5. **Mobile controls compete with content.** The fixed bottom bar takes substantial width/height and displays five primary destinations plus “more”; secondary links move into a sheet. The global floating Bible control sits near the lower-left edge and visibly overlaps registration form content and the child-list error/empty area at 390px. Reserve safe-area space and ensure fixed utilities never cover form fields or primary content.
6. **Data density and hierarchy vary.** KPI cards, gradients, rings, rounded containers, hero banners and inline one-off styles appear across pages. Normalize spacing, card elevations, border radii, table/list density and page action placement. Keep analytics legible without placing every metric in an equally prominent card.
7. **Error and empty states can conflict.** In the inspected child route, the API failure notice appeared alongside zero counts and “no children” empty content. Distinguish “no records yet” from “could not load records”; retain stale-safe content only when clearly labeled and provide retry/recovery context.
8. **Language and localization are absent from the visible UI.** Arabic is hard-coded in the shell; there is no language control or visible locale model. A global SaaS product needs a deliberate language/locale preference and language-aware formatting.
9. **Search has broad reach but unclear scope.** The command palette searches pages, children and servants. Add visible scope, permission-aware result groups, keyboard/focus behavior, and privacy-safe result previews.
10. **Marketing needs a SaaS story.** Current landing copy and walkthrough describe the Sunday School workflow, but do not explain church discovery, multi-church setup, roles, two-year Preview eligibility, support or trust/security expectations. Add this only as future positioning, while preserving the existing service use case.
11. **Small-screen auth is long and vulnerable to overlays.** The servant signup form becomes a tall single column; the fixed Bible control overlays the email field in the captured mobile view. Use a clear multi-step/sectioned form with persistent progress, compact but readable spacing, and fixed controls that yield to content.
12. **Reservation behavior is not represented in the route map.** If reservations are required in the future product, define that journey explicitly; do not relabel attendance sessions as reservations.

## 5. Responsive behavior findings

- CSS breakpoints are centered around 1024px for sidebar versus bottom navigation, 900px for dashboard columns/KPIs, 820px for landing layout, 600px for class cards, and 520–560px for compact layout/forms.
- At desktop widths, the service shell uses a fixed right-side RTL sidebar, a top bar, a content region offset from the sidebar, and a wide multi-section dashboard.
- Below 1024px, the sidebar becomes a fixed floating bottom navigation bar. Secondary links are hidden from the bar and are reachable from a “more” modal/sheet. At mobile width, KPI and form grids collapse and class cards become one column.
- The landing hero stacks vertically on mobile; its idea/walkthrough section also becomes a single column. The landing pill hides secondary anchor/login links at very narrow widths, leaving the brand and primary CTA.
- Auth cards remain centered and expand to available width with outer padding. Registration is scrollable and becomes a long single-column form.
- Safe-area variables are used by fixed shell elements. However, the Bible floating action still overlaps content in observed mobile captures; overlay spacing and stacking need a deliberate audit.
- Responsive layout is evidenced in CSS and the cited screenshots. Browser testing did not exercise every page’s populated/table state or every intermediate width.

## 6. Loading, empty, error and motion patterns

Existing loading patterns include skeleton rows/cards and a small loading fallback on reset-password. Empty states usually include an icon, title, short description and sometimes a next-step action. Errors are shown through inline messages/notices and Sonner toast messages; some screens maintain their own transient toast state. Review each route to ensure fetch failure does not render a success-shaped zero/empty state.

Motion includes the animated landing hero/canvas, the timed rotating walkthrough, button hover/press transforms, card hover elevation, auth-card entrance and decorative drift, sheet entrance, skeleton shimmer, animated bars and the Bible widget’s rotating ring. Reduced-motion handling exists for several key CSS animations but should be applied consistently to all decorative and transition effects.

## 7. Three proposed visual directions

### Direction A — Warm parish editorial

- **Identity:** human, reflective and community-centered; church is present in the visual language without relying on literal religious decoration on every screen.
- **Colors:** warm ivory, ink/forest green, muted clay, soft sage and restrained gold.
- **Typography:** Cairo or another carefully tested Arabic family for Arabic, paired with a highly legible Latin sans; editorial display face only for large marketing headings.
- **Layout:** more whitespace, simple content groups, clear narrative on the public site and calm service dashboards.
- **Navigation:** compact church-aware sidebar with a clear selected location and role; mobile uses a bottom bar for frequent tasks and a labeled sheet for the rest.
- **Components:** thin borders, gentle radii, quieter surfaces, warm illustrations and clear status color tokens.
- **Motion/personality:** quiet transitions and small feedback moments; welcoming, pastoral and trustworthy.

### Direction B — Modern church operations workspace **(recommended)**

- **Identity:** professional multi-tenant SaaS with a clear ministry/community voice. Operational clarity leads; warm accents retain the product’s pastoral character.
- **Colors:** warm near-white and light stone surfaces; deep ink/navy; one confident blue primary; teal for positive/care states; terracotta reserved for emphasis; semantic warning/error colors with accessible contrast.
- **Typography:** Arabic-first pairing such as Cairo for Arabic plus a neutral Latin sans, with a shared, role-based size/weight scale and carefully tuned line heights for each script.
- **Layout:** predictable page title and breadcrumb, primary action in one consistent location, dashboard overview with a small number of high-value metrics, and dense-but-readable list/table screens with strong filter/search controls.
- **Navigation:** persistent desktop sidebar with a church/workspace switcher, role-aware destinations and clear active states; mobile bottom navigation limited to the most-used tasks, with a full labeled navigation drawer/sheet for the rest.
- **Components:** structured cards, consistent tables and empty/error/loading states, compact badges, accessible icon buttons, reusable form field/error patterns, and contextual destructive actions.
- **Motion/personality:** fast state changes, short feedback transitions, subtle loading/progress, no ambient movement in task-heavy surfaces. The product should feel dependable, humane and easy to scan.

### Direction C — Bright learning community

- **Identity:** optimistic and child-centered, suitable for Sunday School learning as a visible product pillar.
- **Colors:** bright cobalt, coral, mint, sunny yellow and soft lavender over clean surfaces.
- **Typography:** friendly Arabic sans with a softer display style for public/learning content; neutral body text for administration.
- **Layout:** modular tiles, illustrated learning journeys, class-focused cards and more prominent visual summaries.
- **Navigation:** icon-led role workspaces with clear labels; mobile uses approachable task shortcuts.
- **Components:** larger icon surfaces, more illustrations, playful progress indicators and color-coded class identity.
- **Motion/personality:** cheerful, gentle motion and celebratory completion feedback. Keep animation out of sensitive child-care or administrator workflows.

### Recommended direction

Choose **Direction B**. The platform must serve multiple churches and roles while managing sensitive child, attendance and pastoral information. A reliable workspace structure will scale better than a marketing-first or childlike visual language. Borrow Direction A’s warmth for brand accents and public onboarding, and use Direction C’s friendly illustrations only in learning-oriented empty states or the public walkthrough. Keep data surfaces restrained and consistent.

## 8. Redesigned interface recommendations

### Public landing page

- Explain the product as a church-management workspace for Sunday School, not only as a servant attendance tool.
- Lead with two clear paths: find/join a church, or register a church. Preserve a separate existing-church member path.
- Present the two-year global Preview program with eligibility, duration and onboarding steps once policy is confirmed. Do not imply billing terms that are not defined.
- Show a product preview that uses generated synthetic records and includes child management, classes, attendance and follow-up views.
- Reduce shader intensity and make performance/reduced-motion behavior predictable; maintain a static first frame and clear content contrast.

### Authentication and onboarding

- Add a church context step before account creation: discover/search an existing church, enter a church code/invitation, or start church registration.
- Separate church administrator registration from servant registration. Explain approval/verification states and role permissions in plain language.
- Make join requests and approval status visible; support resend/cancel/help paths and show the church name/code before submission.
- Retain current login, password recovery, OTP verification and reset flows, but add selected church context and language persistence.
- Use step indicators, clear validation and a confirmation/recovery path. On mobile, keep the form within safe areas and remove/relocate floating controls that obscure fields.

### Church directory and church registration (future functionality)

- Provide a searchable directory with location/denomination filters only if those attributes are intentionally collected; show church name, location, verified status and a short description.
- Design the church registration wizard around required church identity/contact details, administrator identity, code generation, review, and provisioning status.
- Treat the unique church code as a first-class shareable artifact with copy/share actions, clear privacy boundaries, and regeneration/rotation rules defined by product policy.

### Church workspace and servant experience

- Show current church and role in the shell. Keep switching churches explicit and confirm when unsaved work exists.
- Give servants a task-first home: today’s class/attendance, assigned children needing follow-up, upcoming preparation and recent announcements.
- Keep the child care journey focused on relationship history and education progress, with sensitive notes separated by permission and clear authorship/date context.
- Make attendance optimized for one-handed use: select class/date, show roster and last saved state, use large status controls, support undo, and clearly show sync/error states. Keep bulk actions explicit and reversible where possible.
- Use class pages for roster, servants, schedule/lesson preparation and attendance summaries, with consistent permission messaging.

### Church and platform administration (future interfaces)

- Church administrators need member requests, invitations/codes, role assignment, class setup, policies, audit history and workspace settings.
- Platform administrators need a separate global workspace for church directory moderation, tenant provisioning status, Preview eligibility/period, support cases and platform-level audit activity.
- Separate global platform navigation from church-specific navigation. Provide clear labels to prevent administrators from acting in the wrong church context.
- Treat membership requests as a queue with requester, church, requested role, submitted date, decision, and reason/notification feedback.

### Children, classes, attendance and follow-up

- Preserve search, class filters, paging, permissions and all existing profile facets. Add privacy-aware summaries and avoid exposing unnecessary child details in global search.
- Use dense but readable directory rows/tables at desktop and stacked, scannable cards at mobile. Keep primary actions fixed in a predictable location.
- In follow-ups, distinguish priority, status, assignee and overdue date using labels plus color; offer next-step actions without turning care into a gamified queue.
- Use clear, role-specific empty states: no records, no permission, no class assigned, and network/server failure are distinct cases.
- Keep Friday preparation visible as part of the weekly service rhythm and preserve announcement and in-app notification workflows.

### Mobile navigation, feedback and interaction

- Keep only frequent tasks on the mobile bar; “More” should open a labeled, keyboard-accessible sheet with all destinations and account/language/church context.
- Respect device safe areas and ensure bottom nav, toasts, Bible widget and modal layers do not overlap controls. Allow floating utilities to be dismissed or moved out of data-entry screens.
- Use optimistic attendance changes only when rollback/error feedback is clear. Show saved/syncing/saved-at status.
- Standardize hover, pressed, focus, disabled, loading and success states. Use reduced-motion-aware transitions and do not communicate state with color alone.

## 9. Arabic RTL and multilingual requirements

- Store UI copy in locale dictionaries; do not hard-code Arabic strings into page components. Keep number/date/time formatting locale-aware and use the church’s configured timezone.
- Set document `lang` and `dir` from the active locale. Arabic requires RTL; English, French, Spanish and other LTR locales require LTR without changing route meaning.
- Prefer CSS logical properties (`margin-inline`, `inset-inline`, `padding-inline`) and direction-aware layout primitives. Audit every flex/grid order and directional icon; mirror navigation arrows when they indicate direction, but do not mirror universal/status icons.
- Use a tested Arabic font fallback and separate language typography tokens. Tune line-height, punctuation, numerals, labels and mixed-script wrapping by locale.
- Set `dir="auto"` for user-entered names/notes where direction is unknown. Isolate identifiers, church codes, email addresses, phone numbers and other LTR strings in RTL text (for example with `bdi` or an explicit LTR span).
- Ensure fields support appropriate mobile keyboards, country/locale phone formats, localized validation and readable placeholders. Do not assume Arabic numerals for codes or identifiers.
- Test long translations, text expansion, truncation, screen readers, keyboard navigation, focus order, accessible labels, charts, tables and date pickers in both directions.
- Persist the language choice at account level and allow a pre-login language choice. Church language defaults must not silently override a person’s explicit preference.

## 10. Existing functionality that must not be lost

- Servant sign-in and registration, optional avatar upload, password recovery, OTP verification, password reset, profile editing and password change.
- Role-aware access and class-level permissions.
- Child directory, search/filter/pagination, child profiles, assigned servant, parent/contact details, notes, progress and visitation/care history.
- Class listing/details, servant assignments/rosters, class imagery and class-specific summaries.
- Attendance sessions with present, absent, late and excused states; date/class selection, bulk marking, recent sessions, report/export affordance and attendance analytics.
- Pastoral follow-up cases, priorities/statuses, assignment, activities/history, configurable rules, overdue indicators and evaluation/create actions.
- Service dashboard with attendance, class, child, follow-up and news summaries; analytics and care metrics.
- Friday preparation, church news/announcements, in-app notifications/read state/preferences, and the Bible verse widget as existing optional utility.
- Responsive desktop sidebar/mobile navigation, theme toggle, quick search, loading skeletons, empty states, error messages, toast feedback and reduced-motion support.

## 11. Clear separation of present and proposed

**Observed today:** an Arabic RTL Sunday School service application with servant registration, church-specific operational workflows and a single church-oriented brand/copy direction.  
**Proposed for the SaaS redesign:** church directory/discovery, church registration and generated unique codes, invitation-code joining, membership approval, role-specific church/platform admin experiences, multilingual selection, and the global two-year Preview program. These should be designed as new product journeys; they are not current frontend screens.

## Addendum: public website implementation after discovery

The discovery findings and original screenshots above describe the application before the public-site work. The current `/` route is now a visitor-facing landing page, visually separate from the authenticated Sunday School workspace. It includes the responsive header, faith-centered hero, benefits, synthetic product preview, feature and process sections, church discovery/join entry points, global Preview message, FAQ, contact notice, and footer. Existing authenticated routes remain separate.

The new `/register/church`, `/register/church/provisioning`, `/churches`, and `/join` screens are real responsive UI routes. They use an allowlisted Next-to-Nest proxy, but the matching Nest public endpoints and central platform database are not implemented yet. Therefore these screens do not provision databases, return church listings, generate codes, create membership, or approve join requests. Empty/unavailable states do not contain fabricated churches or real personal data. `/privacy` and `/terms` identify themselves as drafts pending owner/legal approval.

### Current public-site screenshots

Captured with Playwright against the local production build on 12 November 2026. Landing preview data is synthetic; the directory and join views show their empty visitor states because the public API is not available.

| Route / viewport | Screenshot |
|---|---|
| `/` Arabic, desktop 1440px, full page | `.playwright-mcp/final-landing-desktop-ar-full.png` |
| `/` English, desktop 1440px, full page | `.playwright-mcp/final-landing-desktop-full.png` |
| `/` English, tablet 768px | `.playwright-mcp/final-landing-tablet-en-768.png` |
| `/` Arabic, mobile 390px | `.playwright-mcp/final-landing-mobile-ar.png` |
| `/` English, mobile 390px | `.playwright-mcp/final-landing-mobile.png` |
| `/register/church` English, desktop 1440px | `.playwright-mcp/final-church-registration-desktop.png` |
| `/register/church` Arabic, mobile 390px | `.playwright-mcp/final-church-registration-mobile-ar.png` |
| `/register/church` English, mobile 390px | `.playwright-mcp/final-church-registration-mobile.png` |
| `/churches` English, desktop 1440px | `.playwright-mcp/final-churches-desktop.png` |
| `/churches` English, mobile 390px | `.playwright-mcp/final-churches-mobile.png` |
| `/join` English, desktop 1440px | `.playwright-mcp/final-join-desktop.png` |
| `/join` English, mobile 390px | `.playwright-mcp/final-join-mobile.png` |

The public landing CTAs point to `/register/church`, `/login`, `/churches`, `/join`, or the product showcase anchor. The church match screen links to the preserved servant `/register` route and `/login`. Desktop, tablet, and mobile smoke checks found no horizontal overflow. Arabic and all seven LTR dictionaries were checked at mobile size on `/` and `/register/church`; native-speaker review remains outstanding.
