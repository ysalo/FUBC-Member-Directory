# Church Directory for iPhone

A fresh SwiftUI application for a private church directory and ministry coordination. The application covers member contacts, groups, birthdays, visit invitations, favorites and personal reminders, with separate member/editor/administrator permissions and pastor/deacon responsibilities.

This branch replaces the prototype. It carries forward requirements and database definitions only. Application code, tests, fixtures, documentation and tooling are newly written. The prototype remains available through Git history at `4d158ca3b33cf18024f45ab9300f48be183eee56`.

## Start here

- [What you need to test: Mac, iPhone and Apple account](docs/TESTING_SETUP.md)
- [Product requirements and acceptance criteria](docs/REQUIREMENTS.md)
- [Implementation and verification status](docs/STATUS.md)
- [Apple release checklist](docs/RELEASE.md)
- [Security and environment boundaries](docs/SECURITY.md)

## Repository

| Directory | Purpose |
| --- | --- |
| `ios/` | SwiftUI source, project configuration and new native tests |
| `supabase/` | Consolidated schema, subsequent native features, functions and new fixtures/tests |
| `tools/` | Independently written development and verification tools |
| `docs/` | Setup, requirements, verification, security and release guidance |

The app is developed on `feature/swiftui-app`. It is not an App Store release. A working source tree is not evidence of an iOS build: native compilation and device testing require Xcode on a Mac. See the status document for checks actually performed.

## Development rules

Use a separate staging backend with fictional data. Do not apply the initial schema to an existing populated Supabase project. Never commit user records, provider secrets, signing keys or production credentials. Only public client configuration belongs in the app.

Test all supported roles and revoked access through the backend, not merely by hiding controls. Newly authored tests must demonstrate behavior independently of the retired web app. Merge only after native build/test, real-device flows and fresh-environment setup have been verified.
