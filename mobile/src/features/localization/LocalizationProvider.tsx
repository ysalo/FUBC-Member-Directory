import { createLocaleHydration } from "./locale-preference";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from "react";

export type AppLocale = "en" | "uk";

const translations = {
  en: {
    pendingAccounts: "Accounts awaiting approval",
    tabs: { directory: "Directory", groups: "Groups", visitation: "Visitation", schedule: "Schedule", manage: "Manage", menu: "Menu" },
    directory: {
      addMember: "Add member",
      careUpdates: "Care updates",
      emptyDetail: "Try another name, ministry, or note.",
      emptyTitle: "No matching people",
      search: "Search by first or last name",
      searchLabel: "Search directory",
      title: "Directory",
      viewAll: "View all",
      visitRequests: "Visit requests",
      upcomingBirthdays: "Upcoming birthdays",
    },
    menu: {
      appearance: "Appearance",
      system: "System",
      light: "Light",
      dark: "Dark",
      language: "Language",
      licenses: "Open-source licenses",
      licenseDetail: "Ionicons — MIT License",
      title: "Menu",
    },
    placeholders: {
      groups: "Browse ministry and small-group rosters.",
      manage: "Administration tools appear here for authorized roles.",
      return: "Return to Directory",
      visitation: "Review requests, assignments, and follow-up.",
    },
  },
  uk: {
    pendingAccounts: "Облікові записи, що очікують схвалення",
    tabs: { directory: "Довідник", groups: "Групи", visitation: "Відвідування", schedule: "Розклад", manage: "Керування", menu: "Меню" },
    directory: {
      addMember: "Додати учасника",
      careUpdates: "Турбота й супровід",
      emptyDetail: "Спробуйте інше ім’я, служіння або примітку.",
      emptyTitle: "Нікого не знайдено",
      search: "Пошук за ім’ям або прізвищем",
      searchLabel: "Пошук у довіднику",
      title: "Довідник",
      viewAll: "Переглянути всі",
      visitRequests: "Запити на відвідування",
      upcomingBirthdays: "Найближчі дні народження",
    },
    menu: {
      appearance: "Вигляд",
      system: "Системний",
      light: "Світлий",
      dark: "Темний",
      language: "Мова",
      licenses: "Ліцензії відкритого коду",
      licenseDetail: "Ionicons — ліцензія MIT",
      title: "Меню",
    },
    placeholders: {
      groups: "Перегляд складу служінь і малих груп.",
      manage: "Інструменти адміністрування для уповноважених ролей.",
      return: "Повернутися до довідника",
      visitation: "Перегляд запитів, призначень і подальших дій.",
    },
  },
} as const;

type LocalizationValue = {
  copy: (typeof translations)[AppLocale];
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
};

const LocalizationContext = createContext<LocalizationValue | null>(null);

export function LocalizationProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<AppLocale>("en");
  const hydration = useRef<ReturnType<typeof createLocaleHydration> | null>(null);
  useEffect(() => {
    const pending = createLocaleHydration();
    hydration.current = pending;
    const read = async () => Platform.OS === "web" ? window.localStorage.getItem("fubc.locale") : SecureStore.getItemAsync("fubc.locale");
    void pending.restore(read, setLocaleState);
    return pending.cancel;
  }, []);
  const setLocale = (next: AppLocale) => {
    hydration.current?.cancel();
    setLocaleState(next);
    if (Platform.OS === "web") {
      try { window.localStorage.setItem("fubc.locale", next); } catch { /* Keep the current language when storage is unavailable. */ }
    } else void SecureStore.setItemAsync("fubc.locale", next).catch(() => undefined);
  };
  const value = useMemo(() => ({ copy: translations[locale], locale, setLocale }), [locale]);
  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useLocalization() {
  const value = useContext(LocalizationContext);
  if (!value) throw new Error("useLocalization must be used inside LocalizationProvider");
  return value;
}
