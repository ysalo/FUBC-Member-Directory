import type { Json } from "@/lib/database";

type Locale = "en" | "uk";
const actions: Record<string, [string, string]> = {
  save_person: ["Member updated", "Дані учасника змінено"],
  deacon_save_member: ["Member updated by deacon", "Дані учасника змінено дияконом"],
  save_group: ["Group updated", "Групу змінено"], delete_group: ["Group deleted", "Групу видалено"],
  save_member_family: ["Family connections updated", "Сімейні зв’язки змінено"],
  record_member_departure: ["Member departure recorded", "Вибуття учасника записано"],
  set_person_photo: ["Member photo updated", "Фото учасника змінено"],
  set_person_photo_metadata: ["Photo details updated", "Дані фото змінено"],
  delete_member_record: ["Member permanently deleted", "Учасника видалено назавжди"],
  import_members_from_csv: ["Members imported", "Учасників імпортовано"],
  "member.removed": ["Member removed", "Учасника вилучено"],
  "account.updated": ["Account updated", "Обліковий запис змінено"],
  "account.designation": ["Account designation updated", "Призначення облікового запису змінено"],
  "duty_schedule.generated": ["Duty schedule generated", "Розклад чергування створено"],
  "audit.rollback": ["Changes restored", "Зміни відновлено"],
};
const legacyActions: Record<string, string> = {
  "person.saved": "save_person", "person.photo": "set_person_photo", "group.saved": "save_group",
  "group.deleted": "delete_group", "member.deleted": "delete_member_record", "member.departed": "record_member_departure",
  "members.csv_imported": "import_members_from_csv",
};
const entities: Record<string, [string, string]> = {
  people: ["Member", "Учасник"], people_private: ["Member details", "Дані учасника"],
  deacon_groups: ["Group", "Група"], deacon_group_members: ["Group responsibility", "Відповідальність за учасника"],
  deacon_group_deacons: ["Group deacon", "Диякон групи"], person_ministries: ["Ministry assignment", "Призначення служіння"],
  member_family_edges: ["Family connection", "Сімейний зв’язок"], member_departures: ["Member departure", "Вибуття учасника"],
};
export function auditActionLabel(action: string, locale: Locale) {
  return actions[legacyActions[action] ?? action]?.[locale === "uk" ? 1 : 0] ?? action;
}
export function auditEntityLabel(entity: string, locale: Locale) {
  return entities[entity]?.[locale === "uk" ? 1 : 0] ?? entity;
}
export function auditSubjectSummary(labels: Record<string, string> = {}, total = Object.keys(labels).length) {
  const names = [...new Set(Object.values(labels))];
  const hidden = Math.max(0, total - Object.keys(labels).length);
  return names.join(" · ") + (hidden ? ` · +${hidden}` : "");
}
function snapshotName(value: Json | undefined): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  return typeof value.name === "string" && value.name.trim() ? value.name : undefined;
}
export function auditRecordLabel(entity: string, before: Json | undefined, after: Json | undefined, labels: Record<string, string> = {}) {
  const oldName = snapshotName(before), newName = snapshotName(after);
  if (entity === "people" || entity === "deacon_groups") {
    if (oldName && newName && oldName !== newName) return `${oldName} → ${newName}`;
    if (newName || oldName) return newName || oldName;
  }
  return auditSubjectSummary(labels);
}
