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
  future:
    "Choose a valid future time. For a repeated daylight-saving hour, choose another time.",
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
  future:
    "Оберіть коректний майбутній час. Для повторюваної години переходу на зимовий час оберіть інший час.",
  confirmCancel: "Скасувати цей запит на відвідування?",
  noDeacons:
    "Немає активних дияконів. Попросіть адміністратора призначити диякона.",
  refresh: "Оновити",
  changed:
    "Пастор оновив запит. Перегляньте поточні час, місце та примітки нижче.",
};
export const visitCopy = (locale: Locale) => (locale === "uk" ? uk : en);
export function localVisitTime(iso: string, zone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
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
// Match the wall-clock time against possible zone offsets. Reject gaps and ambiguous hours.
export function visitTimeToIso(local: string, zone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new Error("Invalid time");
  const wall = Date.parse(local + "Z");
  if (!Number.isFinite(wall)) throw new Error("Invalid time");
  const matches = new Set<string>();
  for (let offset = -840; offset <= 840; offset += 15) {
    const iso = new Date(wall + offset * 60000).toISOString();
    if (localVisitTime(iso, zone) === local) matches.add(iso);
  }
  if (matches.size !== 1) throw new Error("Invalid or ambiguous time");
  return [...matches][0];
}
