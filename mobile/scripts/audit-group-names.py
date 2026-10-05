#!/usr/bin/env python3
"""Audit a transcribed group against a main CSV without storing private names in code.

The resolutions file maps source names to approved {name, birth_date?} identities
and contains an omitted_names array for people intentionally left out of import.
Original transcription, resolutions and outputs stay outside the repository.
"""
import argparse
import csv
import hashlib
import json
import re
from collections import Counter
from datetime import date
from pathlib import Path


def normalize(name):
    return re.sub(r'\s+', ' ', name.translate(str.maketrans({'’': "'", 'ʼ': "'", '‘': "'"}))).strip().casefold()


def full_name(row):
    return ' '.join(row[field].strip() for field in ('last_name', 'first_name', 'patronymic') if row[field].strip())


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--roster', type=Path, required=True)
    parser.add_argument('--transcription', type=Path, required=True)
    parser.add_argument('--group-file', type=Path, required=True)
    parser.add_argument('--resolutions', type=Path, required=True)
    parser.add_argument('--skip-lines', type=int, default=3, help='Header lines before member names')
    args = parser.parse_args()
    roster = list(csv.DictReader(args.roster.open(encoding='utf-8-sig')))
    group = json.loads(args.group_file.read_text(encoding='utf-8'))
    decisions = json.loads(args.resolutions.read_text(encoding='utf-8'))
    approved = decisions.get('approved_names', {})
    omitted = set(decisions.get('omitted_names', []))
    names = [n.strip() for n in args.transcription.read_text(encoding='utf-8').splitlines()[args.skip_lines:] if n.strip()]
    assert set(approved) <= set(names), 'Approved resolutions must refer to transcribed names'
    assert omitted <= set(names), 'Omissions must refer to transcribed names'
    assert not omitted & set(approved), 'A name cannot be both omitted and approved'
    index = {}
    for csv_row, person in enumerate(roster, 2):
        index.setdefault(normalize(full_name(person)), []).append((csv_row, person))
    rows, members, verify, issues = [], [], [], []
    for source_row, source_name in enumerate(names, 1):
        resolution = approved.get(source_name)
        target = resolution['name'] if resolution else source_name
        birth_date = resolution.get('birth_date') if resolution else None
        if birth_date:
            assert date.fromisoformat(birth_date).isoformat() == birth_date
        candidates = index.get(normalize(target), [])
        if birth_date:
            candidates = [(i, p) for i, p in candidates if p.get('birth_date') == birth_date]
        evidence = [{'csv_row': i, 'name': full_name(p), 'birth_date': p.get('birth_date')} for i, p in candidates]
        if resolution:
            assert len(candidates) == 1, f'Approved identity is not unique in main: {source_name}'
        if source_name in omitted:
            status = 'omitted_by_user'
            reason = 'User excluded this person from import. ' + ('No full-name match in main CSV.' if not candidates else 'Main CSV matches recorded below.')
        elif len(candidates) == 1:
            status = 'resolved_from_main_roster' if resolution else 'exact_unique_match'
            reason = 'User-approved main-roster identity.' if resolution else 'Unique full-name match after whitespace, case and apostrophe normalization.'
            name = full_name(candidates[0][1])
            members.append({'name': name, 'birth_date': birth_date} if birth_date else name)
        else:
            status = 'ambiguous_roster_match' if candidates else 'no_roster_match'
            reason = 'Multiple main-roster records match; choose a birth date.' if candidates else 'No full-name match in main CSV; no person created.'
        row = {'source_row': source_row, 'source_name': source_name, 'status': status, 'reason': reason, 'roster_candidates': evidence}
        rows.append(row)
        if status in {'omitted_by_user', 'ambiguous_roster_match', 'no_roster_match'}:
            issue = {'role': 'member', 'name': source_name, **row}
            issues.append(issue)
            if status != 'omitted_by_user':
                verify.append(issue)
    identities = [(normalize(p if isinstance(p, str) else p['name']), None if isinstance(p, str) else p['birth_date']) for p in members]
    assert len(set(identities)) == len(identities), 'Repeated import identity'
    if len(group['deacons']) == 1:
        issues.append({'role': 'deacon', 'name': '', 'status': 'second_deacon_not_supplied', 'blocking': False, 'reason': 'Source lists one deacon. Importer and backend support one or two; no second deacon is assigned.'})
    for deacon in group['deacons']:
        name = deacon if isinstance(deacon, str) else deacon['name']
        matches = index.get(normalize(name), [])
        if not isinstance(deacon, str):
            matches = [(i, p) for i, p in matches if p.get('birth_date') == deacon['birth_date']]
        assert len(matches) == 1, f'Deacon requires a unique main-roster match: {name}'
    metadata = {'roster_file': str(args.roster.resolve()), 'roster_sha256': hashlib.sha256(args.roster.read_bytes()).hexdigest(), 'roster_record_count': len(roster), 'transcription_file': str(args.transcription.resolve()), 'member_status_counts': dict(Counter(r['status'] for r in rows)), 'accepted_members': len(members), 'live_roster_checked': False}
    group.update(members=members, verify=verify, audit=metadata, notes=[
        'Names resolved from the main CSV using the saved user decisions. Original names and omissions are retained in the audit and issues files.',
        'Date-qualified identities require an exact name and birth-date match in the live roster.',
        'One or two deacons are supported. Live-app deacon eligibility must be verified.',
    ])
    folder, stem = args.group_file.parent, args.group_file.stem
    write_json(folder / f'{stem}-name-audit.json', {**metadata, 'rows': rows})
    write_json(folder / f'{stem}-issues.json', {'group': group['name'], 'issues': issues})
    lines = [f"# {group['name']} name audit", '', f"Main CSV: `{args.roster.resolve()}` ({len(roster)} records).", '', f'{len(names)} source members; {len(members)} accepted; {len(verify)} unresolved import entries. Omitted people remain in the separate issues file.', '', 'Birth dates use YYYY-MM-DD and resolve only exact name/date matches. Live-roster matching has not been checked by this script.', '', '| Row | Source name | Main record | Status |', '| --- | --- | --- | --- |']
    for row in rows:
        evidence = '; '.join(f"{p['name']} (DOB {p['birth_date']}, CSV row {p['csv_row']})" for p in row['roster_candidates']) or 'No match'
        lines.append(f"| {row['source_row']} | {row['source_name']} | {evidence} | {row['status']}: {row['reason']} |")
    (folder / f'{stem}-name-review.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    write_json(args.group_file, group)
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
