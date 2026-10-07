import { memberContactRecord } from "./contact-record";
import type { MemberProfile } from "./member-repository";

const escapeText = (value: string) => value.replace(/\\/g, "\\\\")
  .replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");

// Fold by UTF-8 bytes without splitting a character. Continuations count the space.
function fold(line: string) {
  const encoder = new TextEncoder();
  let result = "", bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) { result += "\r\n "; bytes = 1; }
    result += character;
    bytes += size;
  }
  return result;
}

export function memberVCard(profile: MemberProfile, name: string) {
  const contact = memberContactRecord(profile, name);
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${escapeText(name.trim())}`,
    `N:${[contact.familyName ?? "", contact.givenName ?? "", contact.middleName ?? "", "", ""].map(escapeText).join(";")}`];
  for (const phone of contact.phones ?? []) if (phone.number) lines.push(`TEL;TYPE=CELL:${escapeText(phone.number)}`);
  for (const email of contact.emails ?? []) if (email.address) lines.push(`EMAIL;TYPE=WORK:${escapeText(email.address)}`);
  for (const address of contact.addresses ?? []) if (address.street) lines.push(`ADR;TYPE=HOME:;;${escapeText(address.street)};;;;`);
  return [...lines, "END:VCARD"].map(fold).join("\r\n") + "\r\n";
}

export function contactFileName(name: string) {
  return `${name.replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, "").trim().slice(0, 100) || "contact"}.vcf`;
}
