#!/usr/bin/env python3
"""Convert the generated member and audit JSON files to Excel-friendly CSV."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Any


MEMBER_COLUMNS = [
    "name",
    "patronymic",
    "gender",
    "email",
    "phone",
    "membership_joined_at",
    "birth_date",
    "address",
]
AUDIT_COLUMNS = [
    "record_type",
    "row",
    "member_name",
    "field",
    "issue",
    "address_value",
    "home_phone_found",
    "phone_number_source",
]


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as source:
        return json.load(source)


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as destination:
        writer = csv.DictWriter(destination, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({
                key: "" if row.get(key) is None else row.get(key, "")
                for key in fieldnames
            })


def convert_members(source: Path) -> Path:
    data = load_json(source)
    if not isinstance(data, list) or any(not isinstance(row, dict) for row in data):
        raise ValueError(f"{source} must contain a JSON array of member objects")

    columns = list(MEMBER_COLUMNS)
    extra_columns = sorted({key for row in data for key in row if key not in columns})
    columns.extend(extra_columns)
    output = source.with_suffix(".csv")
    write_csv(output, data, columns)
    return output


def convert_audit(source: Path) -> Path:
    data = load_json(source)
    if not isinstance(data, dict):
        raise ValueError(f"{source} must contain an audit JSON object")

    rows: list[dict[str, Any]] = []
    for issue in data.get("issues", []):
        rows.append({"record_type": "issue", **issue})
    for phone in data.get("home_phone_audit", []):
        rows.append({"record_type": "phone_source", **phone})

    output = source.with_suffix(".csv")
    write_csv(output, rows, AUDIT_COLUMNS)
    return output


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert members.json and its audit JSON to CSV files beside the JSON inputs."
    )
    parser.add_argument("members_json", type=Path, help="Path to members.json")
    parser.add_argument(
        "--audit",
        type=Path,
        help="Path to the audit JSON (defaults to members_audit.json beside members.json)",
    )
    args = parser.parse_args()

    members_path = args.members_json.expanduser().resolve()
    if not members_path.is_file():
        parser.error(f"Members JSON does not exist: {members_path}")

    audit_path = args.audit.expanduser().resolve() if args.audit else members_path.with_name("members_audit.json")
    try:
        members_csv = convert_members(members_path)
        print(f"Wrote {members_csv}")
        if audit_path.is_file():
            audit_csv = convert_audit(audit_path)
            print(f"Wrote {audit_csv}")
        else:
            print(f"Audit JSON not found; skipped: {audit_path}", file=sys.stderr)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(f"Could not convert JSON to CSV: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
