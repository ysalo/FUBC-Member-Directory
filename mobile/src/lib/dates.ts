/** Church scheduling policy: fixed UTC−07:00, including winter. Never use America/Los_Angeles. */
export const PDT_OFFSET_MINUTES = -420;
export const PDT_LABEL = "PDT (UTC−07:00)";
export function parseDateOnly(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Use YYYY-MM-DD.");
  const [year, month, day] = match.slice(1).map(Number);
  const check = new Date(0);
  check.setUTCFullYear(year, month - 1, day);
  if (year < 1 || check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) throw new Error("Enter a valid calendar date.");
  return { year, month, day };
}
export function fixedPdtToIso(date: string, time: string): string {
  parseDateOnly(date);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Use a valid 24-hour time (HH:mm).");
  return new Date(`${date}T${time}:00-07:00`).toISOString();
}
export function isoToFixedPdt(value: string): { date: string; time: string } {
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) throw new Error("Invalid timestamp.");
  const shifted = new Date(instant.getTime() + PDT_OFFSET_MINUTES * 60_000).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}
export function formatFixedPdt(value: string, locale: "en" | "uk" = "en"): string {
  const { date, time } = isoToFixedPdt(value);
  const readable = new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  return `${readable}, ${time} PDT`;
}
/** Month/day only; never derive or disclose an age from a birthday projection. */
export function daysUntilBirthday(month: number, day: number, today: string): number {
  const { year } = parseDateOnly(today);
  parseDateOnly(`2000-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  const start = Date.parse(`${today}T00:00:00Z`);
  // Feb 29 is observed on Feb 28 in non-leap years, explicitly and consistently.
  const candidate = (targetYear: number) => {
    const leap = targetYear % 4 === 0 && (targetYear % 100 !== 0 || targetYear % 400 === 0);
    return Date.UTC(targetYear, month - 1, month === 2 && day === 29 && !leap ? 28 : day);
  };
  const next = candidate(year) >= start ? candidate(year) : candidate(year + 1);
  return Math.round((next - start) / 86_400_000);
}
