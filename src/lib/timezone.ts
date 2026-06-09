const BRASILIA_TZ = "America/Sao_Paulo";

/**
 * Returns the current date/time formatted for storage with Brasília offset.
 * Output example: "2026-04-10T14:30-03:00"
 * Compatible with <input type="datetime-local"> when stripped of offset,
 * and with PostgreSQL timestamptz when stored with offset.
 */
export function nowBrasilia(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: BRASILIA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const dateStr = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;

  // Get current Brasília UTC offset (handles DST if ever reintroduced)
  const offset = getBrasiliaOffset(now);
  return `${dateStr}${offset}`;
}

/**
 * Returns today's date in Brasília as "YYYY-MM-DD".
 */
export function todayBrasilia(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: BRASILIA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Formats any ISO/timestamptz string into "dd/MM/yyyy HH:mm" in Brasília timezone.
 */
export function formatBrasiliaDateTime(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRASILIA_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/**
 * Formats any ISO string/date into "dd/MM/yyyy" in Brasília timezone.
 */
export function formatBrasiliaDate(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRASILIA_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/**
 * Appends Brasília offset to a datetime-local value (e.g. "2026-04-10T14:30" → "2026-04-10T14:30-03:00").
 * Use when saving a user-edited datetime-local input to the database.
 */
export function withBrasiliaOffset(datetimeLocal: string): string {
  // If it already has an offset, return as-is
  if (/[+-]\d{2}:\d{2}$/.test(datetimeLocal) || datetimeLocal.endsWith("Z")) {
    return datetimeLocal;
  }
  const date = new Date();
  return `${datetimeLocal}${getBrasiliaOffset(date)}`;
}

/**
 * Strips the timezone offset from an ISO string to make it compatible with <input type="datetime-local">.
 * "2026-04-10T14:30-03:00" → "2026-04-10T14:30"
 */
export function toDatetimeLocalValue(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;

  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: BRASILIA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function getBrasiliaOffset(date: Date): string {
  // Calculate offset by comparing UTC with Brasília local time
  const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
  const brStr = date.toLocaleString("en-US", { timeZone: BRASILIA_TZ });
  const diffMs = new Date(brStr).getTime() - new Date(utcStr).getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const sign = diffHours >= 0 ? "+" : "-";
  const abs = Math.abs(diffHours);
  return `${sign}${String(abs).padStart(2, "0")}:00`;
}
