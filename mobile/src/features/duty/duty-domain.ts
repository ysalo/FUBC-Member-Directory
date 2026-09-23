import type { DutyPeriod } from "@/lib/domain";

export type DutyCandidate = { personId: string; name: string };

/** Matches Directory's own sort key: the last whitespace-separated token of the name. */
export function surnameKey(name: string): string {
  return name.trim().split(/\s+/).at(-1) ?? name;
}

/** Deacons are ordered alphabetically by surname; this is the only default rotation order. */
export function sortCandidatesByLastName(candidates: readonly DutyCandidate[], locale: "en" | "uk" = "en"): DutyCandidate[] {
  return [...candidates].sort(
    (a, b) => surnameKey(a.name).localeCompare(surnameKey(b.name), locale) || a.name.localeCompare(b.name, locale),
  );
}

/** Moves one candidate by a single position while preserving every other candidate's order. */
export function moveCandidate(candidates: readonly DutyCandidate[], personId: string, offset: -1 | 1): DutyCandidate[] {
  const currentIndex = candidates.findIndex((candidate) => candidate.personId === personId);
  const nextIndex = currentIndex + offset;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= candidates.length) return [...candidates];
  const reordered = [...candidates];
  [reordered[currentIndex], reordered[nextIndex]] = [reordered[nextIndex], reordered[currentIndex]];
  return reordered;
}

function isSunday(year: number, month: number, day: number): boolean {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 0;
}

function toDateOnly(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Every Sunday date (YYYY-MM-DD) in the given calendar year, in chronological order. */
export function sundaysInYear(year: number): string[] {
  const sundays: string[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      if (isSunday(year, month, day)) sundays.push(toDateOnly(year, month, day));
    }
  }
  return sundays;
}

/** The paired Friday is always two calendar days before the stored Sunday, across month/year boundaries. */
export function fridayBeforeSunday(sundayOn: string): string {
  const [year, month, day] = sundayOn.split("-").map(Number);
  const friday = new Date(Date.UTC(year, month - 1, day - 2));
  return toDateOnly(friday.getUTCFullYear(), friday.getUTCMonth() + 1, friday.getUTCDate());
}

/**
 * Assigns every Sunday of the year to a deacon by wrapping through the ordered candidate
 * list, mirroring the source spreadsheet's repeating numbered rotation.
 */
export function buildRotation(year: number, orderedCandidates: readonly DutyCandidate[]): DutyPeriod[] {
  if (orderedCandidates.length === 0) return [];
  return sundaysInYear(year).map((sundayOn, index) => ({
    sundayOn,
    personId: orderedCandidates[index % orderedCandidates.length].personId,
    revision: 0,
  }));
}

/** A date falls within a period's weekend when it is the paired Friday, Saturday, or the Sunday itself. */
function isWithinPeriod(period: Pick<DutyPeriod, "sundayOn">, today: string): boolean {
  return today >= fridayBeforeSunday(period.sundayOn) && today <= period.sundayOn;
}

export function currentPeriod(periods: readonly DutyPeriod[], today: string): DutyPeriod | null {
  return periods.find((period) => isWithinPeriod(period, today)) ?? null;
}

/** The next period is the earliest one strictly after today's weekend, so "your next duty" never repeats today. */
export function nextPeriodForPerson(periods: readonly DutyPeriod[], personId: string, today: string): DutyPeriod | null {
  return (
    periods
      .filter((period) => period.personId === personId && period.sundayOn >= today && !isWithinPeriod(period, today))
      .sort((a, b) => a.sundayOn.localeCompare(b.sundayOn))
      .at(0) ?? null
  );
}

export function periodsForPerson(periods: readonly DutyPeriod[], personId: string | null): DutyPeriod[] {
  return personId ? periods.filter((period) => period.personId === personId) : [...periods];
}

export function visibleSchedulePeriods(periods: readonly DutyPeriod[], today: string, showPastDates: boolean): DutyPeriod[] {
  return showPastDates ? [...periods] : periods.filter((period) => period.sundayOn >= today);
}

export function periodsByMonth(periods: readonly DutyPeriod[]): Array<{ month: string; periods: DutyPeriod[] }> {
  const groups = new Map<string, DutyPeriod[]>();
  for (const period of [...periods].sort((a, b) => a.sundayOn.localeCompare(b.sundayOn))) {
    const month = period.sundayOn.slice(0, 7);
    const existing = groups.get(month);
    if (existing) existing.push(period);
    else groups.set(month, [period]);
  }
  return [...groups.entries()].map(([month, monthPeriods]) => ({ month, periods: monthPeriods }));
}

const monthDayLabel = (date: string, locale: "en" | "uk") => {
  const formatter = new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const value = new Date(`${date}T12:00:00Z`);
  if (locale !== "uk") return formatter.format(value);
  return formatter.formatToParts(value).map((part) =>
    part.type === "month" ? `${part.value.charAt(0).toLocaleUpperCase("uk-UA")}${part.value.slice(1)}` : part.value
  ).join("");
};

/** Friday–Sunday, e.g. "Sep 18 – 20" or, crossing a month boundary, "Sep 28 – Oct 2". */
export function weekendLabel(fridayOn: string, sundayOn: string, locale: "en" | "uk"): string {
  return fridayOn.slice(0, 7) === sundayOn.slice(0, 7)
    ? `${monthDayLabel(fridayOn, locale)} – ${sundayOn.slice(8, 10).replace(/^0/, "")}`
    : `${monthDayLabel(fridayOn, locale)} – ${monthDayLabel(sundayOn, locale)}`;
}
