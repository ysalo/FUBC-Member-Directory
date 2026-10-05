type NameFields = { first_name?: string; last_name?: string; name: string; patronymic?: string | null };

export function formatMemberName(name: string | NameFields, patronymic?: string | null, abbreviated = false): string {
  const structured = typeof name !== "string";
  const display = structured ? name.name : name;
  const middle = (structured ? name.patronymic : patronymic)?.trim();
  if (!middle) return structured && name.first_name !== undefined && name.last_name !== undefined
    ? [name.first_name, name.last_name].filter(Boolean).join(" ") : display;
  const [legacyFirst, ...legacySurname] = display.trim().split(/\s+/);
  const first = structured ? name.first_name ?? legacyFirst : legacyFirst;
  const last = structured ? name.last_name ?? legacySurname.join(" ") : legacySurname.join(" ");
  return [first, abbreviated ? `${Array.from(middle)[0]}.` : middle, last].filter(Boolean).join(" ");
}
