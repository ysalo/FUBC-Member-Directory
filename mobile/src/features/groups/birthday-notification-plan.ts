import { daysUntilBirthday, isoToFixedPdt } from "@/lib/dates";
import type { AuthorizedBirthday } from "./groups-repository";

export const BIRTHDAY_NOTIFICATION_KIND = "group-birthday";
export const BIRTHDAY_NOTIFICATION_TIME_ZONE = "Etc/GMT+7";

export function upcomingBirthdays(birthdays: AuthorizedBirthday[], now = new Date()) {
  const today = isoToFixedPdt(now.toISOString()).date;
  return birthdays
    .map((birthday) => ({ ...birthday, daysAway: daysUntilBirthday(birthday.month, birthday.day, today) }))
    .filter((birthday) => birthday.daysAway >= 0 && birthday.daysAway < 7)
    .sort((left, right) => left.daysAway - right.daysAway || left.name.localeCompare(right.name));
}

export function birthdayTrigger(birthday: Pick<AuthorizedBirthday, "month" | "day">) {
  return {
    type: "calendar" as const,
    month: birthday.month,
    day: birthday.day,
    hour: 9,
    minute: 0,
    timezone: BIRTHDAY_NOTIFICATION_TIME_ZONE,
    repeats: true,
  };
}
