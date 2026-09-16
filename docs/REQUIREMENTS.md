# Product requirements and acceptance

This is the new product specification, derived from the prototype's features rather than its client implementation. All tests, fixtures and operational documentation must be authored against these contracts.

## Audience and release scope

One church, approximately 800 directory records, English/Ukrainian, native iPhone UI. The first release includes directory, groups, birthdays, visitation, favorites, one-time personal reminders, Calendar export, private notifications, account lifecycle and native administration. Payments, public social feeds, chat, offline directory replication and two-way Calendar synchronization are excluded.

## Access matrix

| Actor | Allowed behavior |
| --- | --- |
| Signed out | Sign in, access public help/privacy |
| Pending, denied, revoked | View own access status and help; no directory or visit access |
| Active member | Browse permitted directory/groups; own favorites/reminders/preferences |
| Active deacon | Member behavior plus responsibility-group birthdays and specifically addressed visit invitations |
| Active pastor | Member behavior plus create/manage own visits and select recipients |
| Active editor | Member behavior plus member/photo/group maintenance |
| Active administrator | Editor behavior plus account decisions, roles and member linking |

Ministry designation and access role are separate. Pastor/deacon designations remain mutually exclusive. Admin/editor status alone does not unlock private visit data. Group membership and group leadership are separate relationships. The server must enforce these rules regardless of UI or client tampering.

## Acceptance contracts

| Feature | Required evidence |
| --- | --- |
| Identity | Apple and Google cancellation/failure/success; new identity pending; session refresh; sign-out; revoked account loses protected reads |
| Directory | Ukrainian name sorting, search, stable profile back navigation, filters/counts, full-size photo, missing-value presentation |
| Profile | Phone/Maps actions, group links, membership date, birthday/age and approved role/status labels |
| Groups | Search, clear responsibility group, deacon contacts and membership roster; inactive assignments handled |
| Birthdays | Relevant group only, next occurrence and leap-day handling, genuine reminder preference/delivery |
| Visits | Pastor creation and defaults; independent recipient responses; edit/cancel/complete/archive; revision conflicts; pending counts; no duplicate creation on retry |
| Favorites | Owner-only saved people; no cross-account leak on logout/login |
| Reminders | Owner-only create/edit/complete/delete, future time validation, no misleading claim that an unsent alert was delivered |
| Calendar | User-controlled event export; correct instant/timezone; no private notes by default; clearly limited to snapshot export |
| Admin | Create/edit/archive/restore members; photos; group assignment conflicts; approve/deny/revoke/restore; last-admin protection |
| Privacy/support | Accessible support, correction/removal request path, transparent account deletion with confirmed result |
| Accessibility | Dynamic Type, VoiceOver labels, contrast and semantic light/dark colors, reduced-motion respect, bilingual user-facing text |

## Decisions retained pending explicit product change

The prototype's fixed UTC−07:00 visitation conversion and completion/archive rules remain the initial compatibility behavior. Converting visits to named-timezone/DST rules or redefining completed versus archived requires a deliberate product/schema update. Tests must document the actual selected behavior, not silently “fix” it.

Field-level privacy (full birthday, address, family status, notes) and retention after account deletion still need the church's policy. Until settled, avoid adding broader visibility than the schema permits and do not claim final release/privacy readiness.

## Clean-start contract

Only the extracted requirements and current schema objects may carry forward. The prototype migration history, app code, server actions, test implementations, fixtures, assets, docs and CI are discarded from this branch's product tree. Schema routines, triggers and policies are included in the explicit schema exception.

The prototype commit is `4d158ca3b33cf18024f45ab9300f48be183eee56`. An unrelated local edit in the original workspace's ministry SQL contains invalid syntax and is preserved there; it is not part of the new baseline.

Merge requires a fresh checkout that can initialize an empty test backend, run newly written tests and build the iOS target on macOS. Real Apple sign-in, push, permissions and device usability must be verified before calling the app release-ready.
