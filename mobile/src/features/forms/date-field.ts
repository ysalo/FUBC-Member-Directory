export function localDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function acceptsDateFieldValue(value: string, mode: "date" | "time", maximum?: string) {
  if (!value) return true;
  if (mode === "time") return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && localDateValue(date) === value && (!maximum || value <= maximum);
}
