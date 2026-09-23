export function formatMemberName(name: string, patronymic?: string | null, abbreviated = false): string {
  const middle = patronymic?.trim();
  if (!middle) return name;
  const [firstName, ...surname] = name.trim().split(/\s+/);
  return [firstName, abbreviated ? `${Array.from(middle)[0]}.` : middle, ...surname].join(" ");
}