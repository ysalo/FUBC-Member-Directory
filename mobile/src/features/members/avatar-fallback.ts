const avatarTones = [
  { backgroundColor: "#8A4332", textColor: "#FFFFFF" },
  { backgroundColor: "#9A5A18", textColor: "#FFFFFF" },
  { backgroundColor: "#2F6A52", textColor: "#FFFFFF" },
  { backgroundColor: "#2F6473", textColor: "#FFFFFF" },
  { backgroundColor: "#435F91", textColor: "#FFFFFF" },
  { backgroundColor: "#70507A", textColor: "#FFFFFF" },
] as const;

function firstCharacter(value: string): string {
  return Array.from(value)[0]?.toLocaleUpperCase() ?? "";
}

export function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return firstCharacter(parts[0]) || "?";
  return `${firstCharacter(parts[0])}${firstCharacter(parts[parts.length - 1])}` || "?";
}

export function avatarTone(name: string): (typeof avatarTones)[number] {
  let hash = 0;
  for (const character of name.trim().normalize("NFKC").toLocaleLowerCase()) {
    hash = (Math.imul(hash, 31) + (character.codePointAt(0) ?? 0)) >>> 0;
  }
  return avatarTones[hash % avatarTones.length];
}
