export type UpcomingBirthday = { id: string; date: string; daysAway: number };

export function membershipDuration(
  joined: string,
  today: string,
): { years: number; months: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(joined) || !today || joined > today)
    return null;
  const [year, month, day] = joined.split("-").map(Number);
  const [currentYear, currentMonth, currentDay] = today.split("-").map(Number);
  const anniversaryDay = Math.min(
    day,
    new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate(),
  );
  const totalMonths =
    (currentYear - year) * 12 +
    currentMonth -
    month -
    (currentDay < anniversaryDay ? 1 : 0);
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 };
}

export function ageOn(dateOfBirth: string, today: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || !today || dateOfBirth > today)
    return null;
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  const [currentYear, currentMonth, currentDay] = today.split("-").map(Number);
  const leap =
    currentYear % 4 === 0 &&
    (currentYear % 100 !== 0 || currentYear % 400 === 0);
  const birthdayDay = month === 2 && day === 29 && !leap ? 28 : day;
  return (
    currentYear -
    year -
    (currentMonth < month ||
    (currentMonth === month && currentDay < birthdayDay)
      ? 1
      : 0)
  );
}

export function upcomingBirthdays(
  people: { id: string; dateOfBirth: string }[],
  today: string,
): UpcomingBirthday[] {
  const start = new Date(`${today}T00:00:00Z`);
  const year = start.getUTCFullYear();
  return people
    .flatMap((person) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(person.dateOfBirth)) return [];
      const [, month, day] = person.dateOfBirth.split("-").map(Number);
      const occurrence = (y: number) => {
        const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
        return new Date(
          Date.UTC(y, month - 1, month === 2 && day === 29 && !leap ? 28 : day),
        );
      };
      let next = occurrence(year);
      if (next < start) next = occurrence(year + 1);
      const daysAway = Math.round(
        (next.getTime() - start.getTime()) / 86400000,
      );
      return daysAway >= 0 && daysAway < 30
        ? [{ id: person.id, date: next.toISOString().slice(0, 10), daysAway }]
        : [];
    })
    .sort((a, b) => a.daysAway - b.daysAway || a.id.localeCompare(b.id));
}

export function churchToday(
  now = new Date(),
  timezone = process.env.CHURCH_TIMEZONE || "America/Los_Angeles",
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
