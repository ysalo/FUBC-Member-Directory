import type { AppLocale } from "@/features/localization/LocalizationProvider";

import type { PrivacySafeNotification } from "./types";

const genericCopy = {
  en: { title: "Visitation update", body: "Open FUBC Directory to review an update." },
  uk: { title: "Оновлення відвідування", body: "Відкрийте довідник FUBC, щоб переглянути оновлення." },
} as const;

export function createPrivacySafeNotification(
  eventId: string,
  recipientAccountId: string,
  visitId: string,
  locale: AppLocale,
): PrivacySafeNotification {
  return {
    eventId,
    recipientAccountId,
    visitId,
    ...genericCopy[locale],
    data: { route: "/visitation/[id]", visitId },
  };
}

export function isPrivacySafeNotification(notification: PrivacySafeNotification, sensitiveValues: readonly string[]) {
  const externalText = `${notification.title} ${notification.body}`.toLocaleLowerCase();
  return sensitiveValues.filter(Boolean).every((value) => !externalText.includes(value.toLocaleLowerCase()));
}
