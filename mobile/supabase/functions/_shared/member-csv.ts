export const memberCsvMaxBytes = 2 * 1024 * 1024;
export const memberCsvMaxRows = 5000;
export const memberCsvColumns = ["first_name", "last_name", "patronymic", "gender", "email", "phone", "membership_joined_at", "birth_date", "address"] as const;
export type MemberImportRow = {
  first_name: string; last_name: string; patronymic: string | null; gender: "male" | "female";
  email: string | null; phone: string | null; membership_joined_at: string | null; birth_date: string | null; address: string | null;
};
export type CsvIssue = { row: number; field: string; message: string };
export class MemberCsvError extends Error {
  readonly issues: CsvIssue[];
  constructor(issues: CsvIssue[]) { super(issues.map(issue => `Row ${issue.row}, ${issue.field}: ${issue.message}`).join("\n")); this.issues = issues; this.name = "MemberCsvError"; }
}

/** RFC 4180 fields, including BOM, escaped quotes, CRLF, and quoted newlines. */
function readCsv(text: string): { cells: string[]; line: number }[] {
  text = text.replace(/^\uFEFF/, "");
  const records: { cells: string[]; line: number }[] = [];
  let cells: string[] = [], field = "", quoted = false, closed = false, line = 1, start = 1;
  const finishField = () => { cells.push(field); field = ""; closed = false; };
  const finishRecord = () => { finishField(); if (cells.some(cell => cell.trim())) records.push({ cells, line: start }); cells = []; start = line + 1; };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } }
      else { field += char; if (char === "\n" || (char === "\r" && text[i + 1] !== "\n")) line++; }
    } else if (char === ',') { finishField(); }
    else if (char === "\r" || char === "\n") { if (char === "\r" && text[i + 1] === "\n") i++; finishRecord(); line++; }
    else if (char === '"' && !field && !closed) quoted = true;
    else if (closed || char === '"') throw new MemberCsvError([{ row: line, field: "CSV", message: "Unexpected text or quote outside a quoted field." }]);
    else field += char;
  }
  if (quoted) throw new MemberCsvError([{ row: start, field: "CSV", message: "Unclosed quoted field." }]);
  if (field || cells.length || closed) finishRecord();
  return records;
}

export function parseMemberCsv(text: string, today = new Date().toISOString().slice(0, 10)): MemberImportRow[] {
  // UTF-8 byte length without relying on a native TextEncoder polyfill.
  let bytes = 0;
  for (const char of text) { const code = char.codePointAt(0)!; bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4; }
  if (bytes > memberCsvMaxBytes) throw new MemberCsvError([{ row: 1, field: "CSV", message: "File must be 2 MB or smaller." }]);
  const records = readCsv(text);
  if (records.length < 2) throw new MemberCsvError([{ row: 1, field: "CSV", message: "Include a header and at least one member." }]);
  if (records.length - 1 > memberCsvMaxRows) throw new MemberCsvError([{ row: 1, field: "CSV", message: `Import at most ${memberCsvMaxRows} members at a time.` }]);
  const headers = records[0].cells.map(cell => cell.trim());
  const issues: CsvIssue[] = [];
  for (const field of ["first_name", "last_name", "gender"]) if (!headers.includes(field)) issues.push({ row: records[0].line, field, message: "Required column is missing." });
  for (const field of headers) {
    if (!(memberCsvColumns as readonly string[]).includes(field)) issues.push({ row: records[0].line, field, message: "Unknown column. Use the member CSV schema." });
    if (headers.indexOf(field) !== headers.lastIndexOf(field)) issues.push({ row: records[0].line, field, message: "Column appears more than once." });
  }
  if (issues.length) throw new MemberCsvError(issues);
  const identities = new Set<string>();
  const members = records.slice(1).map(({ cells, line }) => {
    const issue = (field: string, message: string) => { issues.push({ row: line, field, message }); };
    if (cells.length !== headers.length) issue("CSV", "Column count does not match the header.");
    const value = (field: string) => { const index = headers.indexOf(field); return index < 0 ? "" : (cells[index] ?? "").trim(); };
    const first_name = value("first_name"), last_name = value("last_name"), patronymic = value("patronymic") || null;
    for (const [field, name] of [["first_name", first_name], ["last_name", last_name]] as const) if (!name || Array.from(name).length > 200) issue(field, "Enter a name between 1 and 200 characters.");
    if (Array.from(`${first_name} ${last_name}`).length > 200) issue("first_name", "Combined first and last names must fit the database's 200 character display name.");
    if (patronymic && Array.from(patronymic).length > 200) issue("patronymic", "Use at most 200 characters.");
    const gender = value("gender").toLowerCase();
    if (gender !== "male" && gender !== "female") issue("gender", "Use male or female.");
    const date = (field: string) => {
      const raw = value(field);
      if (!raw) return null;
      const parsed = new Date(`${raw}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw || raw > today) issue(field, "Use a valid YYYY-MM-DD date that is not in the future.");
      return raw;
    };
    const birth_date = date("birth_date"), membership_joined_at = date("membership_joined_at");
    const rawPhone = value("phone");
    let phone = rawPhone.replace(/\D/g, "");
    if (phone.length === 11 && phone.startsWith("1")) phone = phone.slice(1);
    if (rawPhone && phone.length !== 10) issue("phone", "Use a ten digit US phone number, or leave it empty.");
    const email = value("email") || null, address = value("address") || null;
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) issue("email", "Use a valid email address, or leave it empty.");
    if (address && Array.from(address).length > 2000) issue("address", "Use at most 2000 characters.");
    const identity = JSON.stringify([first_name.toLowerCase(), last_name.toLowerCase(), patronymic?.toLowerCase() ?? "", birth_date ?? ""]);
    if (identities.has(identity)) issue("first_name", "Duplicate name and birth date in this file.");
    identities.add(identity);
    return { first_name, last_name, patronymic, gender: gender as MemberImportRow["gender"], email, phone: phone || null, membership_joined_at, birth_date, address };
  });
  if (issues.length) throw new MemberCsvError(issues);
  return members;
}
