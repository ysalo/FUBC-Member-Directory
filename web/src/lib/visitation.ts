import type { Locale } from "./i18n";
export type VisitRecipient = {
  deacon_id: string;
  deacon_name: string;
  deacon_person_id?: string | null;
  deacon_photo?: string | null;
  response: "pending" | "accepted" | "declined";
  decline_reason: string;
  last_viewed_revision: number;
};
export type Visit = {
  id: string;
  pastor_id: string;
  person_id: string;
  pastor_name: string;
  pastor_person_id?: string | null;
  pastor_photo?: string | null;
  member_name: string;
  member_address: string;
  member_photo?: string | null;
  member_phone?: string | null;
  member_available?: boolean;
  location: string;
  scheduled_at: string;
  notes: string;
  status: "open" | "cancelled" | "completed";
  revision: number;
  updated_fields: string[];
  visit_recipients: VisitRecipient[];
};
export type VisitDeacon = {
  id: string;
  name: string;
  group_id: string | null;
  person_id?: string | null;
  photo_path?: string | null;
};
const en = {
  title: "Visitation",
  requester: "Planned by",
  request: "Plan visit",
  edit: "Edit planned visit",
  mine: "My planned visits",
  invitations: "Invitations",
  address: "Member address",
  location: "Visit location",
  time: "Date and time",
  notes: "Visit notes",
  recipients: "Deacons",
  yourResponse: "Your response",
  manageVisit: "Manage visit",
  person: "Person to visit",
  choosePerson: "Choose a person",
  change: "Change",
  searchPeople: "Search people",
  searchVisits: "Search visits",
  noResults: "No matches found.",
  pendingRequests: "visits awaiting response",
  save: "Save changes",
  submit: "Plan visit",
  accept: "Accept",
  decline: "Decline",
  reason: "Decline reason (optional)",
  cancel: "Cancel planned visit",
  complete: "Mark completed",
  back: "Back",
  empty: "No planned visits yet.",
  updated: "Updated details",
  confirmed: "Companion confirmed",
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  open: "Planned",
  cancelled: "Cancelled",
  completed: "Completed",
  saving: "Saving…",
  failed:
    "Unable to save. Refresh if the visit changed, then try again. Your draft has been retained.",
  missing: "Not provided",
  noGroup: "No active group deacons. Select companions below.",
  optional: "Optional",
  future: "Choose a valid future date and time.",
  confirmCancel: "Cancel this planned visit?",
  noDeacons:
    "No active deacons are available. Ask an administrator to designate a deacon.",
  refresh: "Refresh",
  changed:
    "The pastor updated this planned visit. Review the current time, location, and notes below.",
};
const uk: typeof en = {
  title: "Відвідування",
  requester: "Запланував",
  request: "Запланувати відвідування",
  edit: "Змінити заплановане відвідування",
  mine: "Мої заплановані відвідування",
  invitations: "Запрошення",
  address: "Адреса члена церкви",
  location: "Місце відвідування",
  time: "Дата й час",
  notes: "Примітки до відвідування",
  recipients: "Диякони",
  yourResponse: "Ваша відповідь",
  manageVisit: "Керування відвідуванням",
  person: "Кого відвідати",
  choosePerson: "Оберіть людину",
  change: "Змінити",
  searchPeople: "Пошук людей",
  searchVisits: "Пошук відвідувань",
  noResults: "Збігів не знайдено.",
  pendingRequests: "відвідувань очікують відповіді",
  save: "Зберегти зміни",
  submit: "Запланувати відвідування",
  accept: "Прийняти",
  decline: "Відхилити",
  reason: "Причина відмови (необов’язково)",
  cancel: "Скасувати відвідування",
  complete: "Позначити завершеним",
  back: "Назад",
  empty: "Запланованих відвідувань ще немає.",
  updated: "Деталі оновлено",
  confirmed: "Супровід підтверджено",
  pending: "Очікується",
  accepted: "Прийнято",
  declined: "Відхилено",
  open: "Заплановано",
  cancelled: "Скасовано",
  completed: "Завершено",
  saving: "Збереження…",
  failed:
    "Не вдалося зберегти. Якщо відвідування змінилося, оновіть сторінку та спробуйте ще раз. Чернетку збережено.",
  missing: "Не вказано",
  noGroup: "Немає активних дияконів групи. Оберіть супровід нижче.",
  optional: "Необов’язково",
  future: "Оберіть коректні майбутні дату й час.",
  confirmCancel: "Скасувати це заплановане відвідування?",
  noDeacons:
    "Немає активних дияконів. Попросіть адміністратора призначити диякона.",
  refresh: "Оновити",
  changed:
    "Пастор оновив заплановане відвідування. Перегляньте поточні час, місце та примітки нижче.",
};
export const visitCopy = (locale: Locale) => (locale === "uk" ? uk : en);
// PDT is deliberately fixed at UTC−07:00 throughout the year for visitation.
export const VISIT_TIME_ZONE = "Etc/GMT+7";
export function formatVisitDate(
  iso: string,
  locale: Locale,
  dateStyle: "medium" | "full" = "medium",
) {
  return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
    dateStyle,
    timeStyle: "short",
    hour12: true,
    timeZone: VISIT_TIME_ZONE,
  }).format(new Date(iso));
}
export function localVisitTime(iso: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: VISIT_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function visitTimeToIso(local: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new Error("Invalid time");
  const wall = Date.parse(local + "-07:00");
  if (!Number.isFinite(wall)) throw new Error("Invalid time");
  const iso = new Date(wall).toISOString();
  if (localVisitTime(iso) !== local) throw new Error("Invalid time");
  return iso;
}
