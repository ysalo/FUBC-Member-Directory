import type { GroupManagementState } from "./model";

export const groupFileMaxBytes = 256 * 1024;
export type GroupFile = { version: 1; name: string; kind: "membership" | "responsibility"; deacons: string[]; members: string[] };
export function normalizeGroupName(name: string): string {
  return name.normalize("NFKC").toLocaleLowerCase().replace(/[’‘`ʼ]/g, "'").replace(/\s+/g, " ").trim();
}
export function parseGroupFile(text: string): GroupFile {
  if (new TextEncoder().encode(text).length > groupFileMaxBytes) throw new Error("Group file must be 256 KB or smaller. / Максимальний розмір: 256 КБ.");
  let value: unknown;
  try { value = JSON.parse(text.replace(/^\uFEFF/, "")); } catch { throw new Error("Invalid JSON file. / Некоректний файл JSON."); }
  if (!value || typeof value !== "object") throw new Error("Invalid group file. / Некоректний файл групи.");
  const file = value as Record<string, unknown>;
  const validNames = (names: unknown): names is string[] => Array.isArray(names) && names.every(name => typeof name === "string" && name.trim().length > 0 && name.length <= 200);
  if (file.version !== 1 || typeof file.name !== "string" || !file.name.trim() || file.name.trim().length > 120 || !["membership", "responsibility"].includes(String(file.kind)) || !validNames(file.deacons) || file.deacons.length !== 2 || !validNames(file.members) || file.members.length > 2000) throw new Error("Expected version 1, group name/type, two deacons and member names. / Потрібні версія 1, назва/тип групи, два диякони та імена учасників.");
  const names = [...file.deacons, ...file.members].map(normalizeGroupName);
  if (new Set(names).size !== names.length) throw new Error("Duplicate names in file. / Повторені імена у файлі.");
  return { version: 1, name: file.name.trim(), kind: file.kind as GroupFile["kind"], deacons: file.deacons, members: file.members };
}
export function matchGroupFile(file: GroupFile, data: GroupManagementState): (string | null)[] {
  return [...file.deacons, ...file.members].map((name, index) => {
    const candidates = (index < 2 ? data.deacons : data.members).filter(person => normalizeGroupName(person.importName ?? person.name) === normalizeGroupName(name));
    return candidates.length === 1 ? candidates[0].personId : null;
  });
}
