# Menu experience, 1.8.4

The Menu helps church members read the directory comfortably and manage their own account. Desktop browsers are the primary redesign target; native and browser routes share the same state, content and permissions.

## Observed before

At 1440px the existing page divided its space equally between preferences and account actions. Language was reduced to EN/UA pills, while appearance and text-size controls stretched across gray strips. The account section had similar visual prominence to reading preferences. About displaced the browser shell with a full-screen sheet. At narrow widths the Ukrainian text-size labels were constrained to a single line.

## Design

Retain the established palette: background #F1F0EB, surface #FAF9F6, text #171B20, secondary text #686B70, divider #D8D5CE, accent #EF5A24, with the existing dark palette. Retain the application typeface and text scaling; use a 30px page title, 22px section titles, 17px setting labels and readable 16px choices. Left-align content.

```text
Menu
Preferences (3 parts of width)   Account (2 parts)
  Language: full names             Linked member
  Appearance: radio choices       Sign out / Advanced
  Text size: radio choices       About + current version
                                Installation help
```

Below the shared desktop breakpoint the columns stack. Choices wrap rather than truncate. Accent identifies the selected control and border; selected rows remain quiet. No additional decorative icons, gradients or new typography. Account deletion remains behind Advanced and the existing confirmation route.

The initial idea of reusing pill strips was rejected because it retained the underlying desktop interaction problem. Browser choices use actual radio inputs for arrow-key selection and visible focus. Native uses shared radio labels and touch targets through platform components. About keeps shared content, native page-sheet behavior, and a browser dialog with modal focus management, Escape, backdrop and Done dismissal.

## Findings during validation

Language previously reset on reload; it now uses device storage, with delayed hydration canceled by a user's new selection. Appearance previously constructed an unobserved Supabase upsert builder, which never executed; observing the promise now saves the choice. A pending appearance read also cannot overwrite a newer selection.

A cached local export showed an old Constants version despite current package metadata. A clean export corrected it; build:web now clears Metro's cache. Production 1.8.3 was independently verified as displaying its correct version before this work.

Current Supabase sign-out clears the local session even when remote logout returns an error. Browser checks cover that resulting sign-in state; the auth implementation is preserved. This is not a claim of remote OAuth or physical-device testing.

Manage hub Other tools rows carry disclosure arrows. Inner ministry/member/deacon list rows do not; this applies the user's clarification of where the arrows belong.

## Evidence

- [Before desktop](menu-experience-images/before-desktop.png), [after desktop](menu-experience-images/after-desktop.png).
- [Before 320px Ukrainian large text](menu-experience-images/before-phone-uk-large.png), [after](menu-experience-images/after-phone-uk-large.png).
- [Dark Ukrainian desktop](menu-experience-images/after-desktop-dark-uk-large.png), [bounded phone About](menu-experience-images/after-about-phone.png).

Local verification: `pnpm verify` passed 325 tests with no skips; `pnpm build:web` passed. `tests/menu-browser.mjs` passed ten theme/width cases with no browser errors, unknown backend writes or notification calls. Screenshots were inspected for wrapping, control bounds and visible focus. Hosted Preview/release checks follow the protected branch flow.
