# Group file import

Manage → Groups → Add group → Upload group file accepts a UTF-8 JSON file up to 256 KB:

```json
{
  "version": 1,
  "name": "Group #3 - Auburn, Pacific, Puyallup, Bonney Lake, Lake Tapps, Buckley",
  "kind": "membership",
  "deacons": ["Surname First Patronymic", "Surname First Patronymic"],
  "members": ["Surname First Patronymic"],
  "verify": []
}
```

Use `membership` or `responsibility` for the group kind. One or two deacon names are required. Member names may be empty (up to 2,000); duplicate names are rejected. Unknown metadata such as `areas` and transcription `notes` is ignored. No phones or new member records are needed.

The app matches unique complete names to the existing roster, normalizing case, spacing and apostrophes. Either array accepts plain name strings or objects such as `{ "name": "Surname First Patronymic", "birth_date": "1944-08-19" }`. A supplied date must be a valid YYYY-MM-DD date and match the full birth date exactly; no name-only fallback is used. Same-name people can both be included when each has a distinct birth date. Review choices and group editor rows display birth dates, including the year, or an unavailable label. It does not guess truncated names or spelling changes. Every name can be reviewed and manually matched; deacons must already be eligible deacons in the app. All rows must resolve to distinct people before assignments can be applied to the new group form. Applying the import only fills the draft; Save group uses the existing authorized, atomic `save_group` RPC and assignment-movement confirmation. Existing groups are not overwritten by importing a file; to change an existing group use its editor. Canceling the picker or a parsing failure preserves the import draft. Private files are not committed or cached on web; native picker copies are removed after reading.

The source-photo extraction is `/home/ysalo/Documents/member_list_photos/group-3.json`; `/home/ysalo/Documents/member_list_photos/group-3-name-review.md` compares all 47 names against the corrected processed main `members_import_ready.csv`. Both are private local artifacts, excluded from the repository. The user resolved the photograph names: both Данилюк men use Володимирович and the remaining reviewed names use processed-main spelling. Live-app matching is still required. No backend migration is required.

## Uncertain names

Store unresolved people outside the assignment lists in `verify`, for example:

```json
"verify": [
  { "role": "member", "name": "Name as photographed", "suggested_name": "Possible existing member name" }
]
```

Uploading is rejected if `verify` contains any entry or is not an array. The section must be empty (`[]`) or absent. After checking an entry, move the confirmed existing-person name into `members` (or `deacons` for a deacon), then remove that entry from `verify`. Removing entries without moving their confirmed names omits those people from the group. Suggested names are never automatically assigned.

Imports only attach existing app people. Missing or ambiguous names require choosing an existing roster person; they never create a new member. The only write is the existing group-save RPC. The reviewed photo file contains 45 members, two deacons and an empty verify section.

## Naming convention

Use `Group #<number> - <locations separated by commas>` for imported group headings, preserving every location from the source. Example: `Group #3 - Auburn, Pacific, Puyallup, Bonney Lake, Lake Tapps, Buckley`.

## Reproducible private name audits

`mobile/scripts/audit-group-names.py` processes a transcription against a main CSV. Pass `--roster`, `--transcription`, `--group-file`, and `--resolutions`; `--skip-lines` defaults to three header lines. The resolutions JSON contains `approved_names` (source names mapped to `{name, birth_date?}`) and `omitted_names` (explicit user omissions). Every approved identity must match exactly one main record. Duplicate-name selections include their birth date in the import file. It writes the group file, `<stem>-name-audit.json`, `<stem>-name-review.md`, and a separate `<stem>-issues.json` preserving omissions. Unresolved people remain in `verify`; omitted people are excluded by the saved user decision. A single listed deacon is recorded as nonblocking source information.

Keep input files, decisions, member details, and generated audits outside Git. This script checks the local CSV, not live eligibility or membership; importing uses the app's authorized group-save flow. Group 2 artifacts are under `/home/ysalo/Documents/member_list_photos/group-2-viktor-roshuk/`.
