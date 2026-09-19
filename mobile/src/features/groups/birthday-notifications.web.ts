import type { AppLocale } from "@/features/localization/LocalizationProvider";
import type { AuthorizedBirthday } from "./groups-repository";

export const birthdayNotificationsSupported = false;
// Browser sessions never request permission, schedule reminders, or change native preferences.
export async function disableBirthdayNotifications(_groupId: string) {}
export async function syncBirthdayNotifications(_groupId: string, _birthdays: AuthorizedBirthday[], _locale: AppLocale, _requestPermission: boolean) {}
