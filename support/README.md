# Public support pages

`build.py` creates a small static support/privacy site from a real organization name, monitored contact and approved privacy text. It has no runtime dependency on the native app or retired web application. Python 3 is sufficient to build it.

```sh
python3 support/build.py --organization "Your church's legal name" --contact-email "support@yourchurch.org" --privacy-file /path/to/approved-privacy.txt
```

Review the generated `support/dist/` pages and host them over HTTPS on the church's selected domain. Configure those real URLs in the app and App Store Connect. Publishing is not performed by this script.

The contact above is an example, not a configured support address. No policy is invented by the generator. Do not publish until the policy matches actual collection/retention and the in-app deletion flow is working. The Help copy points to in-app deletion and must not be published while that flow is incomplete.

Policy content must cover account and directory information, photos, sensitive membership/ministry data, visibility, purposes/providers, retention/deletion, correction/removal, minors if applicable, and contact. The church must approve the content and assign an operational support owner.
