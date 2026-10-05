# Group file import

Manage → Groups → Add group → Upload group file accepts a UTF-8 JSON file up to 256 KB:

```json
{
  "version": 1,
  "name": "Дільниця № 3 — Auburn, Pacific, Puyallup, Bonney Lake, Lake Tapps, Buckley",
  "kind": "membership",
  "deacons": ["Surname First Patronymic", "Surname First Patronymic"],
  "members": ["Surname First Patronymic"]
}
```

Use `membership` or `responsibility` for the group kind. Exactly two deacon names are required. Member names may be empty (up to 2,000); duplicate names are rejected. Unknown metadata such as `areas` and transcription `notes` is ignored. No phones or new member records are needed.

The app matches unique complete names to the existing roster, normalizing case, spacing and apostrophes. It does not guess truncated names or spelling changes. Every name can be reviewed and manually matched; deacons must already be eligible deacons in the app. All rows must resolve to distinct people before assignments can be applied to the new group form. Applying the import only fills the draft; Save group uses the existing authorized, atomic `save_group` RPC and assignment-movement confirmation. Existing groups are not overwritten by importing a file; to change an existing group use its editor. Canceling the picker or a parsing failure preserves the import draft. Private files are not committed or cached on web; native picker copies are removed after reading.

The source-photo extraction is `/home/ysalo/Documents/member_list_photos/group-3.json`; `/home/ysalo/Documents/member_list_photos/group-3-name-review.md` compares all 47 names against the corrected processed main `members_import_ready.csv`. Both are private local artifacts, excluded from the repository. Photograph spellings stay in the JSON pending user review. Do not import into a live group until the user verifies uncertain names. No backend migration is required.
