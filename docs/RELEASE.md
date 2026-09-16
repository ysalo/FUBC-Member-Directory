# Release checklist

The app is intended for free, unlisted distribution to approved church members. This document records work to complete, not a claim that enrollment or submission has occurred.

## Development prerequisites

- [ ] Follow [testing setup](TESTING_SETUP.md): Mac/Xcode, iPhone, enrolled church team, separate staging backend.
- [ ] Confirm stable bundle ID and Apple/Google sign-in settings.
- [ ] Implement and demonstrate every [required feature](REQUIREMENTS.md).
- [ ] New unit, integration, authorization and device tests pass.
- [ ] Fresh checkout and empty-database setup work without prototype files/caches.
- [ ] Confirm privacy/retention decisions, real support contact and production URLs.
- [ ] Obtain actual native build and visual/accessibility evidence; Windows source inspection is insufficient.

## Merge and pilot

- [ ] Review the complete replacement on `feature/swiftui-app` and merge only after development gates pass.
- [ ] Disable or update the retired Vercel application's main-branch deployment before pushing a replacement tree.
- [ ] Initialize/reconcile production backend explicitly; never blindly replay the initial baseline against existing data.
- [ ] Tag the verified commit and build the signed candidate from it.
- [ ] Upload to App Store Connect/TestFlight; pilot all roles on real devices with fictional data first.
- [ ] Verify production APNs, Apple login, deletion, Calendar and permissions in the distributed build.

TestFlight distributes prerelease builds and feedback; external testing can require review. It is not permanent church distribution. [Apple TestFlight](https://developer.apple.com/testflight/)

## Submission

- [ ] App icon, truthful description, age-rating answers and current-build screenshots with fictional people.
- [ ] Accurate privacy disclosures for the app and SDKs, support/privacy URLs and export-compliance responses.
- [ ] Working reviewer accounts covering every role, without an approval wait or real congregation data.
- [ ] Reviewer walkthrough of directory, groups, visits, reminders and account deletion; explain role differences.
- [ ] Select manual release so review approval alone does not publish the app.
- [ ] Submit completed build for App Review, state unlisted intent, then file Apple's unlisted-distribution request.
- [ ] Wait for both build approval and unlisted approval before releasing and sharing the link.

Unlisted distribution still uses App Review. Anyone with the download link can obtain the app, so server-side approval remains necessary. [Apple unlisted distribution](https://developer.apple.com/support/unlisted-app-distribution/)

## Operation

Assign owners for support/privacy requests, access administration, membership renewal, signing keys, backups, scheduled workers and iOS/security updates. Record app-build/schema compatibility. Maintain a fictional reviewer dataset for updates and a tested restore procedure. Recheck Apple's requirements at submission time.
