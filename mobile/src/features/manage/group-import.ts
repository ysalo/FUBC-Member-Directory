import type { GroupManagementState } from "./model";

export const groupFileMaxBytes = 256 * 1024;
export type GroupPerson = string | { name: string; birth_date: string };
export type GroupFile = { version: 1; name: string; kind: "membership"; deacons: GroupPerson[]; members: GroupPerson[] };
export function groupPersonName(person: GroupPerson): string {
  return typeof person === "string" ? person : person.name;
}
export function groupPersonBirthDate(person: GroupPerson): string | undefined {
  return typeof person === "string" ? undefined : person.birth_date;
}
export function normalizeGroupName(name: string): string {
  return name.normalize("NFKC").toLocaleLowerCase().replace(/[’‘`ʼ]/g, "'").replace(/\s+/g, " ").trim();
}
function validBirthDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function parseGroupFile(text: string): GroupFile {
  if (new TextEncoder().encode(text).length > groupFileMaxBytes) throw new Error("Group file must be 256 KB or smaller. / Максимальний розмір: 256 КБ.");
  let value: unknown;
  try { value = JSON.parse(text.replace(/^\uFEFF/, "")); } catch { throw new Error("Invalid JSON file. / Некоректний файл JSON."); }
  if (!value || typeof value !== "object") throw new Error("Invalid group file. / Некоректний файл групи.");
  const file = value as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(file, "verify")) {
    if (!Array.isArray(file.verify)) throw new Error("The verify section must be an array. / Розділ verify має бути масивом.");
    if (file.verify.length) throw new Error("Resolve all names in the verify section before uploading. Move confirmed existing-person names into members/deacons, then empty or remove verify. / Перевірте всі імена в розділі verify перед завантаженням. Перенесіть підтверджені імена наявних учасників до members/deacons і очистіть або видаліть verify.");
  }
  if (file.kind === "responsibility" || file.kind === "care") throw new Error("Care group imports are no longer supported. Use a membership group file. / Імпорт груп турботи більше не підтримується. Використайте файл членської групи.");
  const validName = (name: unknown): name is string => typeof name === "string" && name.trim().length > 0 && name.length <= 200;
  const validPeople = (people: unknown): people is GroupPerson[] => Array.isArray(people) && people.every(person => typeof person === "string" ? validName(person) : person !== null && typeof person === "object" && validName(person.name) && validBirthDate(person.birth_date));
  if (file.version !== 1 || typeof file.name !== "string" || !file.name.trim() || file.name.trim().length > 120 || file.kind !== "membership" || !validPeople(file.deacons) || file.deacons.length < 1 || file.deacons.length > 2 || !validPeople(file.members) || file.members.length > 2000) throw new Error("Expected version 1, group name/type, one or two deacons and member names (optionally with birth_date). / Потрібні версія 1, назва/тип групи, один або два диякони та імена учасників (за потреби з birth_date).");
  const datesByName = new Map<string, (string | undefined)[]>();
  for (const person of [...file.deacons, ...file.members]) {
    const name = normalizeGroupName(groupPersonName(person)), birthDate = groupPersonBirthDate(person);
    const dates = datesByName.get(name) ?? [];
    if (dates.some(date => !date || !birthDate || date === birthDate)) throw new Error("Duplicate people in file. / Повторені учасники у файлі.");
    datesByName.set(name, [...dates, birthDate]);
  }
  return { version: 1, name: file.name.trim(), kind: file.kind as GroupFile["kind"], deacons: file.deacons, members: file.members };
}
export function matchGroupFile(file: GroupFile, data: GroupManagementState): (string | null)[] {
  return [...file.deacons, ...file.members].map((person, index) => {
    const name = groupPersonName(person), birthDate = groupPersonBirthDate(person);
    const candidates = (index < file.deacons.length ? data.deacons : data.members).filter(candidate => normalizeGroupName(candidate.importName ?? candidate.name) === normalizeGroupName(name) && (!birthDate || candidate.birthDate === birthDate));
    return candidates.length === 1 ? candidates[0].personId : null;
  });
}
