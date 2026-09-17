import type { AppLocale } from "@/features/localization/LocalizationProvider";

import type { VisitRecord } from "./types";

const googleTimestamp = (value: Date) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function calendarSnapshotUrl(visit: VisitRecord, locale: AppLocale) {
  const start = new Date(visit.scheduledAt);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const query = new URLSearchParams({
    action: "TEMPLATE",
    text: locale === "uk" ? `Відвідування: ${visit.memberName}` : `Visit with ${visit.memberName}`,
    dates: `${googleTimestamp(start)}/${googleTimestamp(end)}`,
    location: visit.location,
    details: locale === "uk" ? "Копія з довідника FUBC" : "Snapshot from FUBC Directory",
  });
  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}
