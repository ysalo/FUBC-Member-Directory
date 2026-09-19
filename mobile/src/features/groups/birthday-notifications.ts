import * as Notifications from "expo-notifications";
import type { AppLocale } from "@/features/localization/LocalizationProvider";
import { BIRTHDAY_NOTIFICATION_KIND, birthdayTrigger } from "./birthday-notification-plan";
import type { AuthorizedBirthday } from "./groups-repository";

export const birthdayNotificationsSupported = true;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

async function cancelGroupNotifications(groupId: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled.filter((request) => request.content.data?.kind === BIRTHDAY_NOTIFICATION_KIND && request.content.data?.groupId === groupId).map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)));
}

export async function disableBirthdayNotifications(groupId: string) {
  await cancelGroupNotifications(groupId);
}

export async function syncBirthdayNotifications(groupId: string, birthdays: AuthorizedBirthday[], locale: AppLocale, requestPermission: boolean) {
  let permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted && requestPermission) permissions = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true } });
  if (!permissions.granted) throw new Error(locale === "uk" ? "Дозвольте сповіщення в налаштуваннях iPhone." : "Allow notifications in iPhone Settings.");
  await cancelGroupNotifications(groupId);
  const content = locale === "uk"
    ? { title: "Сьогодні день народження", body: "Відкрийте групу, щоб побачити учасника." }
    : { title: "Birthday today", body: "Open the group to see the member." };
  await Promise.all(birthdays.map((birthday) => Notifications.scheduleNotificationAsync({
    content: { ...content, sound: true, data: { kind: BIRTHDAY_NOTIFICATION_KIND, groupId, personId: birthday.id } },
    trigger: { ...birthdayTrigger(birthday), type: Notifications.SchedulableTriggerInputTypes.CALENDAR },
  })));
}
