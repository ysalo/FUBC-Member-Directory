# Member CSV import and test-directory replacement

Administrators can open **Manage → Import members**, choose a CSV, review the first ten rows, and add members or replace the directory. Replacement requires typing `REPLACE MEMBERS`. Editors and ordinary members cannot import.

## CSV contract

Headers: `first_name,last_name,patronymic,gender,email,phone,membership_joined_at,birth_date,address`.

`first_name`, `last_name`, and `gender` are required; optional columns may be omitted. Gender is `male` or `female`. Dates use `YYYY-MM-DD` and cannot be in the future. US phone numbers normalize to ten digits; empty optional values become database NULL. Quoted commas/newlines, escaped quotes, UTF-8 BOM and CRLF are supported. Unknown columns, invalid values and duplicate name/patronymic/birth-date identities are rejected. Maximum: 5,000 rows / 2 MB. This is an application import contract spanning `people` and `people_private`, rather than a direct one-table dashboard CSV upload.

Validate and normalize a source without overwriting it (Node 24):

```sh
node mobile/scripts/prepare-member-import.mjs '<source.csv>' '<new-output.csv>'
```

## Deployment and operation order

1. Verify the intended project and account inventory. Authenticate with `supabase login`; credentials belong in the CLI credential store, never in this repository.
2. Apply the reviewed `20261004000000_member_name_fields.sql`, then `20261004010000_member_csv_import.sql` using an authenticated SQL connection. Do not run `db push` until the existing project's migration history is reconciled; see `mobile/supabase/CONNECT_EXISTING_PROJECT.md`.
3. Deploy only the new endpoint: `supabase functions deploy import-members --project-ref <verified-ref> --workdir mobile --use-api --no-verify-jwt`. The endpoint validates the user's JWT with `auth.getUser()` and requires an active administrator. Service-role credentials remain server-side.
4. Validate the complete source before importing. Replacement validates all rows, clears member data, and creates all new members in **one transaction**. A writer failure rolls back the entire replacement. Preserve the operation ID when retrying a lost response.
5. After commit, remove old photos through the Storage API in batches. The database stores a retry queue of object paths, including orphan objects. No Storage download, signed URL, or direct SQL deletion of Storage objects is used. If cleanup fails, retry cleanup without importing again.
6. Verify the account inventory and all imported fields. Recreate groups, schedule, family relationships, ministry assignments and account/member links as needed. Publish the client through the existing feature → dev → main release process.

For explicitly authorized maintenance, the resumable script uses the same guarded SQL import and Storage API cleanup:

```sh
SUPABASE_CLI='<supabase-cli-path>' node mobile/scripts/replace-members.mjs \
  --project-ref '<verified-ref>' --csv '<validated.csv>' \
  --operation-file '<private-operation-receipt.json>' --confirm 'REPLACE MEMBERS'
```

Keep the private operation receipt for retries; it contains the operation UUID and inventory fingerprints, not CSV rows or credentials. The script refuses a different project/source under the same receipt and checks preserved account IDs/emails and profile roles/statuses afterward. It rejects Storage requests other than DELETE. Metadata API responses still transfer small amounts of data; zero image download is not a promise of zero total network egress.

## Replacement scope

Preserved: Auth identities, sign-in state infrastructure, profile identity/display name/status/access role, protected Pastor/Deacon reference definitions, and schema/internal import receipts. Account/member links and designation are cleared.

Cleared: old members and private details, pictures and thumbnails/orphans, groups and assignments, deacon duty, visits/participants/notification history, family links, favorites, reminders, notification preferences/device tokens, custom ministries, account deletion requests and previous application audit history. A new audit record describes the import. No Auth identity deletion endpoint is invoked.

Photo upload writes now call `set_person_photo_metadata` and return only `id`, `revision`, and `photo_path`; the write response includes neither photo bytes nor signed URLs.

## Authorized execution on 2026-10-04

The user confirmed `lxrrjrezpdzyqkevgwyx` is the intended test project, despite its older Production label. Applied both migrations and deployed the endpoint before replacement. Imported **850**, replaced **39**, deleted **134** Storage objects, preserved **6** Auth accounts and all account roles/statuses. All source fields matched the database exactly; missing/extra/changed rows were zero. Member links, groups, schedule, visits, family links and stored photos were zero afterward. Cleanup issued zero image download requests.

Source: `/home/ysalo/Documents/processed/main/A.1. Загальний Список - 01-01-26/members_import_ready.csv`. The preceding gender CSV was corrected for 19 `Микола` records and one `Eсфір` record; the previous version remains as `members_gender_before_correction.csv`. Final counts: 404 male / 446 female. Personal CSV data and private operation receipts are not committed.

Local verification passed: Node 24 typecheck, 224 passed main tests plus one optional concurrency skip, one visitation test and 12 group tests; production web build. Tests cover malformed CSV, authorization, atomic late-writer rollback, account preservation, exact replacement confirmation, idempotent import and cleanup retries, and metadata-only photo responses. The deployed endpoint returned HTTP 401 without a session. Physical native and live OAuth validation are not claimed.

Chromium fixture checks at 390×844 and 1440×900 exercised CSV selection, parsed preview, disabled replacement before confirmation, exact confirmation and completion. No horizontal overflow, page errors, notification permission requests or Storage requests occurred. The backend was synthetic; this does not establish live OAuth or authenticated Preview behavior.
