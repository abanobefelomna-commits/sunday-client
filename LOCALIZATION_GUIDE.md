# Localization Guide

## Supported locale codes

| Locale | Language | Direction | Dictionary status |
|---|---|---|---|
| `ar` | Arabic | RTL | Draft translated strings |
| `en` | English | LTR | Draft translated strings |
| `fr` | French | LTR | Draft translated strings |
| `es` | Spanish | LTR | Draft translated strings |
| `de` | German | LTR | Draft translated strings |
| `it` | Italian | LTR | Draft translated strings |
| `pt` | Portuguese | LTR | Draft translated strings |
| `ru` | Russian | LTR | Draft translated strings |

The dictionaries are in `app/components/public-site/messages.ts` and `flow-messages.ts`; strings are not embedded in the landing component. The current copy is machine/author drafted and has not received native-speaker review. Do not describe the translations as production-reviewed.

## Direction, persistence, and fonts

- `usePublicLocale` restores the selected locale from `localStorage` key `sunday-school-locale`.
- It sets `document.documentElement.lang` and `dir` (`ar` is RTL; the other current locales are LTR).
- Public CSS uses logical properties such as `margin-inline`, `padding-inline`, `inset-inline`, and `border-inline-start`.
- Cairo is already loaded by the root layout with Arabic and Latin subsets.
- Public metadata title and description are updated after locale restoration. Static metadata remains as the server-rendered fallback.
- Locale state currently persists on the same browser, not to a server-side user profile. Authenticated account preference storage is not implemented.
- The current public copy contains no date, price, countdown or locale-dependent numeric claims. When dates or metrics are added, use `Intl.DateTimeFormat`, `Intl.NumberFormat`, and `Intl.PluralRules` with the selected locale.

## Completing translations

1. Have native reviewers approve terminology and tone for each language, especially church, servant, membership, and child-care terms.
2. Keep route labels, validation, API errors, empty/loading states, accessibility names, FAQ, metadata, and legal notices in the locale dictionaries.
3. Add a locale only when its full public route dictionary and RTL/LTR behavior are reviewed.
4. Verify translated text at narrow widths; avoid fixed-width labels and buttons.
5. Add browser coverage for Arabic RTL and English LTR, then smoke-test all other dictionaries for route text and overflow.

## Current completeness

All eight locales have authored landing and public-flow strings. Playwright smoke checks at 390px confirmed that `/` and `/register/church` set the expected `lang` and direction and fit without horizontal overflow. This is layout smoke coverage, not translation review. Native review, account-level persistence, localized auth screens, and full automated RTL/LTR browser coverage remain incomplete. The existing authenticated application has not yet been converted to this locale architecture.
