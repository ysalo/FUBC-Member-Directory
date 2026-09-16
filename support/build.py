"""Build public support pages from approved church information; no default fake contact."""
from argparse import ArgumentParser
from html import escape
from pathlib import Path
import re


def page(title: str, organization: str, content: str) -> str:
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(title)} — {escape(organization)}</title>
<style>:root{{color-scheme:light dark;font-family:system-ui,-apple-system,sans-serif}}body{{max-width:44rem;margin:auto;padding:2rem 1.25rem;line-height:1.6}}nav{{display:flex;gap:1.5rem;flex-wrap:wrap}}a{{color:LinkText;text-underline-offset:.2em}}h1{{line-height:1.15}}p{{white-space:pre-wrap;overflow-wrap:anywhere}}footer{{margin-top:3rem;border-top:1px solid GrayText;padding-top:1rem}}a:focus-visible{{outline:3px solid Highlight;outline-offset:4px}}</style></head>
<body><header><p>{escape(organization)}</p><nav aria-label="Support pages"><a href="index.html">Help</a><a href="privacy.html">Privacy</a></nav></header>
<main><h1>{escape(title)}</h1>{content}</main><footer>Church directory support</footer></body></html>'''


def main() -> None:
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--organization", required=True)
    parser.add_argument("--contact-email", required=True)
    parser.add_argument("--privacy-file", type=Path, required=True, help="Approved privacy policy as plain UTF-8 text")
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "dist")
    args = parser.parse_args()
    if not args.organization.strip() or not re.fullmatch(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", args.contact_email):
        parser.error("Provide the church's name and a real monitored contact email.")
    policy = args.privacy_file.read_text(encoding="utf-8").strip()
    if not policy:
        parser.error("The approved privacy policy must not be empty.")
    args.output.mkdir(parents=True, exist_ok=True)
    contact = escape(args.contact_email, quote=True)
    help_content = (
        '<p>This directory is for approved church members. If you are waiting for approval, '
        'cannot sign in, or need to correct or remove directory information, contact the church.</p>'
        f'<p><a href="mailto:{contact}">Email {contact}</a></p>'
        '<p>To delete your app account, use Settings → Delete account in the app. '
        'The privacy policy explains how account and directory information are handled.</p>'
    )
    (args.output / "index.html").write_text(page("Get help", args.organization, help_content), encoding="utf-8")
    paragraphs = "".join(f"<p>{escape(part)}</p>" for part in policy.split("\n\n"))
    (args.output / "privacy.html").write_text(page("Privacy policy", args.organization, paragraphs), encoding="utf-8")
    print(f"Built support pages in {args.output.resolve()}. Review before publishing.")


if __name__ == "__main__":
    main()
