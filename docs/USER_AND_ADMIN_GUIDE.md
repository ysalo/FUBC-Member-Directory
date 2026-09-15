# User and Administrator Guide

## What the application is

The Private Member Directory is a mobile-first church directory. It is intended for approved members, editors, and administrators rather than the general public. The production test site is `https://fubc-member-directory.vercel.app`.

The current web application can be used in a desktop browser, in Safari on an iPhone, or as an installed home-screen web app. It does not install a service worker and does not intentionally make member records or photos available offline.

## Signing in and requesting access

1. Open the site and select **Continue with Google**.
2. Google verifies the identity; the directory does not create or store a separate password.
3. A first-time identity receives a `pending` account automatically.
4. A pending user sees the awaiting-approval page and cannot read directory records or private photos.
5. An administrator approves or denies the request. After approval, refresh or sign in again to enter the directory.

Apple sign-in is implemented behind `NEXT_PUBLIC_ENABLE_APPLE_AUTH`. It remains hidden while that variable is `false` and until Apple credentials are configured in Supabase.

## Account states and roles

An account has one status and one role.

| Status    | Meaning                                              |
| --------- | ---------------------------------------------------- |
| `pending` | Waiting for an administrator's decision              |
| `active`  | Allowed to use the application according to its role |
| `denied`  | Initial request was not approved                     |
| `revoked` | Previously approved access was withdrawn             |

| Role          | Capabilities when active                                                                    |
| ------------- | ------------------------------------------------------------------------------------------- |
| Member        | Search and view active directory entries and photos                                         |
| Editor        | Member access plus add, edit, archive, restore, and manage photos                           |
| Administrator | Editor access plus review accounts, assign roles, and link an account to a directory member |

## Using the directory

The directory loads active member records ordered by last name and then first name. Users can search by name, phone, address, or date. Selecting a row opens the member profile, where phone numbers can be called and addresses can be opened in Apple Maps. Selecting a profile photograph opens it full screen.

The member record stores first and last name, date of birth, membership join date, phone, structured mailing address, optional photo, notes, archive state, and timestamps. The `membership_joined_at` application code is ready, but the additive migration must be applied to Supabase before that release is deployed.

The directory follows the iPhone Contacts pattern: members are grouped under last-name alphabet headings, sorted using the name data's locale, and accompanied by a right-side alphabet index. Ukrainian names use Ukrainian collation and the full Ukrainian alphabet even when the interface is displayed in English.

## Editing directory records

Active editors and administrators can open **Manage** from the directory.

- Add a member with required first and last names and optional contact/profile data.
- Upload JPG, PNG, or WebP photos no larger than 4 MB.
- Edit an existing record or replace/remove its photo.
- Archive a record to remove it from ordinary directory results.
- Restore an archived record.

Uploaded photos are stored in the private Supabase `member-photos` bucket. The bundled demo images use public application paths only as fictional placeholders.

## Reviewing account requests

Only active administrators can open **Account requests**.

1. Find the identity in Pending, Active, Denied, or Revoked.
2. Choose the role. New approvals default to Member.
3. Optionally link the login account to one directory member.
4. Add an internal decision note if useful.
5. Approve, deny, revoke, restore, or save the account's access.

The database prevents an administrator from revoking or demoting themselves and prevents removal of the final active administrator. Each decision is written to the audit log in the same database transaction as the profile change.

## English and Ukrainian

The application supports English and Ukrainian interfaces:

- A language control switches application labels between English and Ukrainian.
- The preference is retained in an application cookie.
- Ukrainian member names remain Ukrainian data; switching the interface does not translate names or English postal addresses.
- Directory sorting and alphabet navigation follow the language of the member names, independently of the interface language.

The language preference is available on sign-in, access-status, directory, profile, member-management, and account-management screens. Production will receive it when this release is deployed after the database migration.
