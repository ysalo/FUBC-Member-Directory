# Native development

Requires a Mac running an Xcode version supporting iOS 17 or newer. Windows can edit sources, but cannot run SwiftUI, Simulator, signing, or these native tests.

## Preview without Apple membership

Install Xcode, launch it once, and install an iOS Simulator runtime in Xcode Settings. Install XcodeGen (`brew install xcodegen`) then, from the repository root:

```sh
xcodegen generate --spec ios/project.yml
open ios/ChurchDirectory.xcodeproj
```

Select **ChurchDirectoryPreview**, an iPhone Simulator, and Run. This Debug configuration uses newly authored fictional in-memory records. No backend, Apple sign-in, push entitlements, or paid developer account is needed. All preview edits disappear when the process restarts. Native tests are available using Product > Test. Command-line example (choose an installed simulator name):

```sh
xcodebuild -project ios/ChurchDirectory.xcodeproj -scheme ChurchDirectoryPreview -destination 'platform=iOS Simulator,name=iPhone 16' test CODE_SIGNING_ALLOWED=NO
```

## Configured integration build

Copy `Configuration/Local.example.xcconfig` to `Configuration/Local.xcconfig`. Configure the empty staging Supabase project only: host (without https prefix), publishable key, church-owned bundle ID and Apple team ID. Never place a service-role key, APNs private key, Apple secret or production records in the app. Local.xcconfig is ignored.

Regenerate the Xcode project, select **ChurchDirectory**, and select your team under Signing & Capabilities. This uses Staging configuration with Sign in with Apple and Push Notifications entitlements. A registered Apple Developer Program team is required for those capabilities. Configure your bundle ID with Apple sign-in, Supabase Apple provider native client-ID audience, Google provider, and `churchdirectory://auth/callback` as an allowed Supabase redirect. Use a provisioned physical iPhone for acceptance tests. Missing configuration shows an error; it never silently falls back to preview data.

Release archives always use real mode and production APNs. The exact Supabase Swift package version is pinned in project.yml. Resolve and commit Package.resolved on the first verified Mac build to record transitive dependencies.

## Verification still required

These sources were authored on Windows. A successful Xcode compile, runtime UI review, staging integration tests and device checks must be recorded before treating the app as validated. The cloud macOS workflow is a compile/test gate, not a replacement for physical-device authentication/push/accessibility checks. The deployment target of iOS 17 and iPhone-only device family are provisional product defaults.

Preview success does not establish live backend authorization. Verify every access role, two-account invitation conflicts, revoked access, offline sign-out, notification permissions and Calendar export against staging. Calendar exports minimal details as a snapshot through Apple's event editor; it does not automatically synchronize updates.
