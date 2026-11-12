# Public Website Design Specification

## Scope

The public website is the visitor experience at `/`. It is separate from the authenticated Sunday School workspace and does not change the workspace navigation or dashboard layout. The page follows the supplied `PUBLIC_LANDING_PAGE_REFERENCE.png` composition with a sky-blue and soft-white base, navy copy, royal-blue actions, and restrained warm-gold accents.

The hero illustration is a local, replaceable crop at `public/images/public-hero-illustration.jpg`. It is not rendered as a page background. The hero and the product preview are separate semantic components. The product preview uses labels and chart shapes only; it contains no church, member, or child records.

## Page sections and components

| Section | Implementation | Visitor action |
|---|---|---|
| Public header | `PublicHeader` in `app/components/public-site/PublicLanding.tsx` | Home, feature/how anchors, directory, FAQ/contact anchors, locale selector, `/login`, `/register/church` |
| Hero | Headline, localized copy, local faith-centered image, two actions | Church registration or product showcase anchor |
| Benefits strip | Five compact icon-and-copy items | Informational |
| Product showcase | `ProductPreview`, synthetic interface illustration, feature checklist | `/register/church` |
| Features | Six cards with explicit current/planned state | Informational |
| How it works | Four-step church/admin/servant journey | Informational; clearly marked in development |
| Church discovery | Public directory entry and join entry | `/churches`, `/join` |
| Preview | Global two-year policy statement; no countdown, price, or checkout | `/register/church` |
| FAQ | Native keyboard-operable `<details>` disclosure controls | Informational |
| Contact | No invented email, phone, address, or response-time promise | FAQ anchor until verified channel is published |
| Footer | Directory, FAQ, login, privacy and terms links | Valid internal routes |

Reusable elements are intentionally kept within the public-site component group. `PublicFlowShell` is the related shell for public registration, directory, join, and policy routes. It does not wrap the logged-in application.

## Visual tokens

| Token | Value | Use |
|---|---|---|
| Sky 50 | `#f2f8ff` | Soft section and icon surfaces |
| Sky 100 | `#e6f1ff` | Secondary fills |
| Blue 500 | `#2464e8` | Primary interaction color |
| Blue 600 | `#174fc5` | Hover and emphasis |
| Primary CTA gradient | `#2865d8` → `#1555d5` | White CTA text remains above 5:1 contrast |
| Navy 900 | `#11284e` | Headlines and dark surfaces |
| Navy 700 | `#29446a` | Supporting text |
| Gold | `#e0ad4f` | Small faith/warmth accents |
| Surface | `#ffffff` | Cards and controls |
| Line | `#dce7f3` | Borders and separators |

Typography uses the existing Cairo web font, which has Arabic and Latin subsets. Layout uses logical inline/block properties and the document direction supplied by the selected locale.

## Responsive behavior and accessibility

- Wide screens use a balanced two-column hero and showcase; small screens place the copy and primary CTA before the illustration.
- Navigation collapses to a keyboard-operable menu at 760px. Directory and join journeys remain real routes.
- Benefit and feature grids reduce columns as viewport width narrows. Cards and controls have minimum touch sizes and text can wrap.
- Visible focus rings, skip links, semantic headings/sections/forms, labels, status announcements, and `aria-expanded` are provided.
- Motion is limited to brief control transitions and loading indicators. `prefers-reduced-motion` disables transitions and animation.
- Public layouts hide the existing Bible widget overlay so it does not cover public navigation or calls to action.

## Route map and current integration state

| Route | Purpose | State |
|---|---|---|
| `/` | Public marketing landing page | Implemented with eight locale dictionaries |
| `/login` | Existing authentication | Existing route preserved |
| `/register` | Existing servant registration | Existing route preserved; not reused for church registration |
| `/register/church` | New church registration form | UI implemented; waits on the public API contract |
| `/register/church/provisioning` | Provisioning progress and private church-code presentation | UI implemented; waits on provisioning API |
| `/churches` | Public directory search | UI implemented; degrades gracefully when API is unavailable |
| `/join` | Code/directory lookup and pending request | UI implemented; authenticated submission requires API membership support |
| `/privacy`, `/terms` | Policy notice routes | Routes exist; official owner-approved legal text is still required |

The Next route handler at `/api/public/*` is a constrained, no-store proxy to the Nest API (`NEST_API_URL`, with the existing API base as a fallback). It exposes only the documented public route shapes and does not query tenant databases. Until the Nest endpoints and platform database are available, registration, directory data, code lookup, join requests, and provisioning are not operational. The client shows service-unavailable states rather than fabricating results.

Preview copy states the requested global two-year period, no card and no payment collection, and the shared official start date rule. The public page does not invent or display a start/end date. The copy is not yet hydrated from protected platform configuration; this remains an API integration item.

## Verification snapshot

- The production build was smoke-tested at 1440px desktop, 768px tablet, and 390px mobile widths. `/`, `/register/church`, `/churches`, and `/join` had no horizontal overflow at the tested sizes.
- The landing and church registration screens were smoke-tested in Arabic and all seven LTR dictionaries at 390px. Browser `lang` and `dir` followed the selected locale.
- The first keyboard Tab reaches the skip link with a visible focus outline. `prefers-reduced-motion` reduces transitions and animations.
- Playwright screenshots are listed in `UI_UX_DISCOVERY_REPORT.md` and stored under `.playwright-mcp/`.
- The locally rendered Vercel Analytics script requested `/_vercel/insights/script.js` and received 404; this did not affect page rendering.

## Known limitations

- The translation dictionaries have not been reviewed by native speakers.
- Responsive behavior and RTL/LTR were smoke-tested at representative sizes, but full keyboard/screen-reader, browser-matrix, and automated contrast testing remain pending.
- Church registration/provisioning, unique code creation/rotation, directory search, join requests and approval are not live until the canonical API and membership model are implemented.
- Privacy and Terms pages are explicit notices that final approved text is pending, not legal agreements.
- Translations have not been reviewed by native speakers, and locale preference is browser-local only rather than stored in an authenticated user profile.
- Public Preview copy is static product messaging, not yet sourced from secured central platform settings. Do not display dates, countdowns, or prices until that integration is complete.
- The reference image was provided in a local implementation package; the full source reference is not copied into this repository.
