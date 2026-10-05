import type { Member } from "./members";

const lookalikes: Record<string, string> = { A: "А", B: "В", C: "С", E: "Е", H: "Н", I: "І", K: "К", M: "М", O: "О", P: "Р", T: "Т", X: "Х", Y: "У", a: "а", c: "с", e: "е", i: "і", o: "о", p: "р", x: "х", y: "у" };
/** Repair visual Latin lookalikes only in otherwise Cyrillic names. */
export function directorySurname(member: Pick<Member, "name" | "last_name">): string {
  const surname = (member.last_name ?? member.name.trim().split(/\s+/).at(-1) ?? "").trim().normalize("NFC");
  return /[\u0400-\u04ff]/u.test(surname) ? surname.replace(/[A-Za-z]/g, letter => lookalikes[letter] ?? letter) : surname;
}
const alphabet = (surname: string) => /^[\u0400-\u04ff]/u.test(surname) ? 0 : /^[A-Za-z]/.test(surname) ? 1 : 2;
/** Stable church directory order: Cyrillic alphabet, Latin alphabet, other names. */
export function compareDirectoryNames(a: { surname: string; member: Pick<Member, "name"> }, b: { surname: string; member: Pick<Member, "name"> }): number {
  return alphabet(a.surname) - alphabet(b.surname) || a.surname.localeCompare(b.surname, alphabet(a.surname) === 0 ? "uk" : "en") || a.member.name.localeCompare(b.member.name, "uk");
}
