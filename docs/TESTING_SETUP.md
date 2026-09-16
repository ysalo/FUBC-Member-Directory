# How to set up and test the iPhone app

Written September 16, 2026. This guide distinguishes what you can start now from the Apple-connected tests that need enrollment. No account purchase or remote setup has been performed on your behalf.

## The short answer

Use a **Mac with Xcode** to build the app and test screens in an iPhone Simulator. Use a **real iPhone** to verify sign-in, notifications, permissions and usability. Start with the Simulator, then test on the phone; neither replaces the other.

You do **not** need paid membership to begin building and testing the interface in Simulator. For our complete app with real **Sign in with Apple, remote push notifications and TestFlight**, enroll in the Apple Developer Program or join an enrolled church team.

| Stage | Equipment/accounts | What it proves |
| --- | --- | --- |
| UI previews and fictional demo | Mac, Xcode and a Simulator runtime | Screen layout, navigation, accessibility and local logic |
| Basic device development | Mac, iPhone, free Apple Account in Xcode | Limited personally signed development builds; not our full Apple-services setup |
| Connected staging tests | Mac, iPhone, enrolled Apple team and staging Supabase | Real login, approval, permissions, database workflows and notifications |
| Church pilot | Publisher's enrolled team/App Store Connect; testers' iPhones and TestFlight | Installation and behavior of a distributed release candidate |

Free Personal Team profiles expire after seven days and have capability/device limits. The program membership belongs to the publishing team; ordinary TestFlight testers do not buy developer memberships. [Apple account overview](https://developer.apple.com/help/account/basics/about-your-developer-account), [capability matrix](https://developer.apple.com/help/account/reference/supported-capabilities-ios)

## 1. Prepare the Mac

1. Use a Mac that supports a current Xcode release. Check [Apple's Xcode/macOS compatibility table](https://developer.apple.com/xcode/system-requirements) before purchasing or upgrading hardware.
2. Install Xcode, open it once, accept its license and install the iOS platform/Simulator components it offers.
3. In Xcode Settings, choose an installed Command Line Tools version under Locations. Run `xcodebuild -version` in Terminal to check the active toolchain.
4. Obtain this repository's `feature/swiftui-app` branch on the Mac. This working branch is local until it is pushed/shared; do not expect a remote checkout to contain unpublished changes.
5. Follow the generated project instructions in `ios/README.md` once the native project is available. Use the demo/preview configuration first, with fictional data and no backend secrets.
6. Select an iPhone Simulator and Run. Use a smaller model as well as a larger one, and check light/dark appearance and larger text.

Simulator is included with Xcode. Windows can edit code and run suitable backend tests, but it cannot run Xcode or the iOS Simulator. A remote Mac is an alternative; a Windows installation of Swift does not supply the Apple SDKs. [Running in Simulator](https://help.apple.com/xcode/mac/current/en.lproj/devfd9e28378.html)

## 2. Start Apple enrollment now

Recommended owner: the church's legal organization, with an authorized Account Holder. Prepare its legal name, D-U-N-S number, public website and domain email. The representative needs an Apple Account with two-factor authentication. Enroll in the standard Apple Developer Program and complete verification. Standard membership is USD 99 annually, with regional differences; eligible nonprofits can request a fee waiver. Invite the maintainer to the team rather than sharing credentials. [Enrollment](https://developer.apple.com/help/account/membership/program-enrollment), [nonprofit fee waiver](https://developer.apple.com/help/account/membership/fee-waivers)

You can work on demo screens while enrollment is pending. Do not register a temporary publishing identity solely to avoid waiting unless you deliberately accept the later ownership/identity migration work.

## 3. Create staging Supabase

1. Create a separate Supabase project for development/staging, using an organization/account the church controls.
2. Record its project URL and publishable key in local native configuration. The publishable key identifies the project; RLS and the user's session provide authorization.
3. Initialize the **empty project** using the new `supabase/` baseline and later migrations. Never run the baseline against the prototype's populated project.
4. Apply the newly written fictional fixtures and documented administrator bootstrap. Do not upload real congregation data for initial tests.
5. Configure authentication providers and exact allowed callback URLs for the native app.
6. Test using separate member, deacon, pastor and administrator accounts. A successful Apple login does not automatically grant church access: new accounts remain pending until approved.

The schema in this branch is derived from the latest committed prototype definitions. Live schema parity must be audited before reusing any existing hosted environment.

## 4. Enable real Sign in with Apple

After enrollment is active, the Account Holder/maintainer should:

1. Choose a stable church-controlled bundle ID, for example `org.yourchurch.directory` (an example, not an identifier already registered).
2. Register the App ID under the church team and enable **Sign in with Apple**.
3. In the native project's Signing & Capabilities settings, select that team and use the same bundle ID. Enable the corresponding entitlement.
4. Enable Apple's provider in staging Supabase with the native app identifier permitted by its configuration. Follow the native-auth section of [Supabase's Apple guide](https://supabase.com/docs/guides/auth/social-login/auth-apple).
5. Test the native Apple authorization sheet, successful token exchange, cancelled login, returning users and Hide My Email. Store profile details when supplied; do not assume Apple sends a full name on every sign-in.
6. Verify that sign-out, session restoration, revocation and account deletion behave correctly. Do not merge identities by display name or assume an Apple relay email equals a previous Google identity.

Native Apple ID-token sign-in and web OAuth are different configurations. A Services ID/client secret may be needed for browser OAuth and Apple token-management flows; configure the actual implemented flows rather than creating every Apple identifier indiscriminately. Provider/private keys stay in server secrets, never app source.

## 5. Run on your iPhone

1. Connect the phone to the Mac, unlock it and accept “Trust This Computer.”
2. Open Xcode's device management window and let pairing finish.
3. Enable Developer Mode when Xcode asks. On the phone this is normally under Settings → Privacy & Security → Developer Mode; restart and confirm if prompted.
4. Choose the connected iPhone as the run destination. Select the church development team and let Xcode manage signing.
5. Run the staging build. Use fictional accounts and verify a complete login/approval/directory flow.

Developer Mode is relevant to development installs. Church members installing the eventual App Store app do not need it. [Apple's Developer Mode instructions](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)

## 6. Test notifications and Calendar

Push testing needs the app's Push Notifications capability, APNs signing credentials configured on the trusted backend worker, a registered device token and a functioning event sender. Merely allowing notifications on the iPhone does not configure delivery.

Use two accounts: a pastor creates a visit and a deacon receives it. Test the app open, backgrounded and closed; tap the notification; deny permission; change/cancel the visit; sign out; revoke the recipient. Notifications should expose no private notes or addresses on the lock screen. Use the in-app invitation list when delivery is delayed or disabled.

For Calendar, add a fictional visit through the system editor, then verify its date/time on the phone. The exported event is a snapshot, not a promise of automatic synchronization.

## 7. Move to TestFlight after the local tests

Create the App Store Connect record, upload a signed build from a verified commit, test internally, then invite a small external church pilot. External testing may need Beta App Review. Members install TestFlight, accept their invitations and use ordinary Apple Accounts. They do not need a Mac, Xcode or a developer subscription. [TestFlight](https://developer.apple.com/testflight/)

Keep staging and production separate. Confirm the distributed build's push environment and production login settings, not just the earlier Xcode build. Unlisted App Store distribution comes after testing and review; it is not required to begin testing.

## What you need to provide

- Access to a compatible Mac and an iPhone, or a chosen remote Mac arrangement.
- An authorized church representative to enroll, accept agreements and manage the team.
- Church legal details, website/domain email and fee-waiver eligibility information.
- A staging Supabase project and eventual support contact/domain.

Do not send passwords, private signing keys or recovery codes in chat. We can prepare code/configuration templates now; signed Apple-connected verification remains pending until the equipment and team configuration are available.
