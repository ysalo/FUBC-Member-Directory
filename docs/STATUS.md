# Implementation and verification status

Last updated September 16, 2026. This status is deliberately separate from the target requirements.

## Workspace

- Branch: `feature/swiftui-app`.
- New worktree: `D:/church_directory-swiftui`.
- Prototype reference: `4d158ca3b33cf18024f45ab9300f48be183eee56`.
- The inherited tracked product tree was removed before implementation.
- The original workspace and its unrelated uncommitted SQL edit are preserved.
- No live Supabase deployment, Apple enrollment, App Store upload or merge has occurred.

## Implemented source

- Single consolidated application schema plus new native feature migrations, environment configuration and independently written fixtures/tests.
- SwiftUI project definition with separate fictional preview and connected staging/release schemes; pinned Supabase SDK, native Apple/Google sign-in and Keychain sessions.
- Native directory/profile/group/birthday, visitation, favorites/reminders, settings and administration screens with English/Ukrainian resources and newly created app icon.
- Server-side preferences, favorites, reminders and device registrations; service-only notification outbox with leases, retries, authorization rechecks and per-device results.
- HTTP/2 APNs worker with ES256 signing, English/Ukrainian generic alerts and no private data in notification text.
- New setup/security/release documentation, public support-page generator and macOS/backend CI workflow.

These are source implementations, not proof of a completed native release. The agents are reviewing API contracts and source while the first native build is prepared.

## Verification performed on Windows

- New embedded PostgreSQL/PGlite suite: 20 tests passed, including Apple first-consent profile names, native API projections and stale group transfers.
- APNs worker: 10 new tests passed for cryptographic signatures, HTTP/2 headers/outcomes, payload privacy/localization, authorization checks and retries.
- Support generator help/HTML smoke check passed.
- No Swift test or native UI result is claimed from this Windows environment.

## Known incomplete release work

- Account deletion currently records a request only; it does not delete the Auth identity, remove all associated information or revoke Apple tokens. Church retention policy and a complete trusted deletion workflow are still required. It does not satisfy release acceptance yet.
- No real support domain/contact or approved privacy policy has been configured/published.
- New source/UI still requires native compilation, runtime review and all real-device acceptance checks below.
- No Apple secrets, real APNs send, remote scheduler or live schema deployment has been configured.

## External verification still required

- Mac/Xcode compilation, native tests and Simulator review.
- Real iPhone sign-in, APNs, permission, Calendar and accessibility tests.
- Apple team/bundle/capability configuration and staging provider settings.
- Comparison of the locally derived schema against any hosted project selected for reuse.
- Church privacy/retention and support details.
- TestFlight pilot and App Review.

The current Windows environment has no Xcode or iOS Simulator. Until a macOS build succeeds, the native code must be treated as unverified source, not a working installable app. Missing Apple configuration must not be disguised as successful authentication or notification delivery.
