import { Linking } from "react-native";

import type { AppLocale } from "@/features/localization/LocalizationProvider";

import type { VisitRecord } from "./types";
import { calendarSnapshotUrl } from "./calendar-url";

export interface CalendarSnapshotExporter {
  openSnapshot(visit: VisitRecord, locale: AppLocale): Promise<void>;
}

export const calendarSnapshotExporter: CalendarSnapshotExporter = {
  async openSnapshot(visit, locale) {
    await Linking.openURL(calendarSnapshotUrl(visit, locale));
  },
};
