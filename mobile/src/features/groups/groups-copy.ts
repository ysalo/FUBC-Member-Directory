import type { AppLocale } from "@/features/localization/LocalizationProvider";

export const groupsCopy = {
  en: {
    title: "Groups", search: "Search groups", searchMembers: "Search members", myGroup: "My group", otherGroups: "Other groups", allGroups: "All groups", openGroup: "Opens the group roster", openDeaconProfile: "Opens deacon profile",
    members: "Members", responsibleDeacons: "Responsible deacons", deacon: "Deacon", noDeacons: "No deacons", noDeaconsAssigned: "No deacons assigned", birthdays: "Next 7 days", birthdayNotifications: "Birthday notifications", birthdayNotificationDetail: "On the birthday at 9:00 AM PDT", noUpcomingBirthdays: "No birthdays in the next seven days.", notificationError: "Birthday notifications could not be updated.", summary: (total: number, orphans: number, widows: number) => `${total} members · ${orphans} orphans · ${widows} widows`,
    noGroups: "No groups found", noGroupsDetail: "Try another search.", noOtherGroups: "No other groups yet", noOtherGroupsDetail: "Your group is still available above.", noMembers: "No members in this group yet.", noMatchingMembers: "No members match this search.",
    unavailable: "This group is unavailable", unavailableDetail: "It may have been removed or you may no longer have access.", retry: "Try again", loading: "Loading groups…", error: "We couldn’t load groups.",
    back: "Groups", memberCount: (count: number) => `${count} ${count === 1 ? "member" : "members"}`,
  },
  uk: {
    title: "Групи", search: "Пошук груп", searchMembers: "Пошук учасників", myGroup: "Моя група", otherGroups: "Інші групи", allGroups: "Усі групи", openGroup: "Відкриває список учасників групи", openDeaconProfile: "Відкриває профіль диякона",
    members: "Учасники", responsibleDeacons: "Відповідальні диякони", deacon: "Диякон", noDeacons: "Немає дияконів", noDeaconsAssigned: "Дияконів не призначено", birthdays: "Наступні 7 днів", birthdayNotifications: "Сповіщення про дні народження", birthdayNotificationDetail: "У день народження о 9:00 PDT", noUpcomingBirthdays: "У наступні сім днів немає днів народження.", notificationError: "Не вдалося оновити сповіщення про дні народження.", summary: (total: number, orphans: number, widows: number) => `${total} учасників · ${orphans} сиріт · ${widows} вдів`,
    noGroups: "Груп не знайдено", noGroupsDetail: "Спробуйте інший пошук.", noOtherGroups: "Інших груп поки немає", noOtherGroupsDetail: "Ваша група залишається доступною вище.", noMembers: "У цій групі ще немає учасників.", noMatchingMembers: "За цим пошуком учасників не знайдено.", unavailable: "Ця група недоступна", unavailableDetail: "Можливо, її видалено або ви більше не маєте доступу.", retry: "Спробувати ще раз", loading: "Завантаження груп…", error: "Не вдалося завантажити групи.",
    back: "Групи", memberCount: (count: number) => `${count} ${count === 1 ? "учасник" : "учасників"}`,
  },
} as const;

export const getGroupsCopy = (locale: AppLocale) => groupsCopy[locale];
