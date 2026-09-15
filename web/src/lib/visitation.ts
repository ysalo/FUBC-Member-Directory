import type { Locale } from "./i18n";
export type VisitRecipient = {
  deacon_id: string;
  deacon_name: string;
  response: "pending" | "accepted" | "declined";
  decline_reason: string;
  last_viewed_revision: number;
};
export type Visit = {
  id: string;
  pastor_id: string;
  person_id: string;
  pastor_name: string;
  member_name: string;
  member_address: string;
  location: string;
  scheduled_at: string;
  notes: string;
  status: "open" | "cancelled" | "completed";
  revision: number;
  updated_fields: string[];
  visit_recipients: VisitRecipient[];
};
export type VisitDeacon = { id: string; name: string; group_id: string | null };
const en = {
  title: "Visitation",
  requester: "Requested by",
  request: "Request visit",
  edit: "Edit request",
  mine: "Requested by me",
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
  pendingRequests: "pending requests",
  save: "Save changes",
  submit: "Submit request",
  accept: "Accept",
  decline: "Decline",
  reason: "Decline reason (optional)",
  cancel: "Cancel request",
  complete: "Mark completed",
  back: "Back",
  empty: "No visit requests yet.",
  updated: "Updated details",
  confirmed: "Companion confirmed",
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  open: "Open",
  cancelled: "Cancelled",
  completed: "Completed",
  saving: "Saving…",
  failed:
    "Unable to save. Refresh if the request changed, then try again. Your draft has been retained.",
  missing: "Not provided",
  noGroup: "No active group deacons. Select companions below.",
  optional: "Optional",
  future: "Choose a valid future date and time.",
  confirmCancel: "Cancel this visit request?",
  noDeacons:
    "No active deacons are available. Ask an administrator to designate a deacon.",
  refresh: "Refresh",
  changed:
    "The pastor updated this request. Review the current time, location, and notes below.",
};
const uk: typeof en = {
  title: "Відвідування",
  requester: "Запит від",
  request: "Запросити відвідування",
  edit: "Змінити запит",
  mine: "Мої запити",
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
  pendingRequests: "запитів очікують відповіді",
  save: "Зберегти зміни",
  submit: "Надіслати запит",
  accept: "Прийняти",
  decline: "Відхилити",
  reason: "Причина відмови (необов’язково)",
  cancel: "Скасувати запит",
  complete: "Позначити завершеним",
  back: "Назад",
  empty: "Запитів на відвідування ще немає.",
  updated: "Деталі оновлено",
  confirmed: "Супровід підтверджено",
  pending: "Очікується",
  accepted: "Прийнято",
  declined: "Відхилено",
  open: "Відкрито",
  cancelled: "Скасовано",
  completed: "Завершено",
  saving: "Збереження…",
  failed:
    "Не вдалося зберегти. Якщо запит змінився, оновіть сторінку та спробуйте ще раз. Чернетку збережено.",
  missing: "Не вказано",
  noGroup: "Немає активних дияконів групи. Оберіть супровід нижче.",
  optional: "Необов’язково",
  future: "Оберіть коректні майбутні дату й час.",
  confirmCancel: "Скасувати цей запит на відвідування?",
  noDeacons:
    "Немає активних дияконів. Попросіть адміністратора призначити диякона.",
  refresh: "Оновити",
  changed:
    "Пастор оновив запит. Перегляньте поточні час, місце та примітки нижче.",
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
