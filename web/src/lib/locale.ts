import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n";

export async function getLocale(): Promise<Locale> {
  return (await cookies()).get("app_locale")?.value === "uk" ? "uk" : "en";
}
