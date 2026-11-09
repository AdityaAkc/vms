import {
  addDays as dfAddDays,
  addMonths as dfAddMonths,
  differenceInCalendarDays,
  format,
  parseISO,
} from "date-fns";
import type { ISODate } from "./types";

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

/** Today's calendar date in the given IANA timezone, as `YYYY-MM-DD`. */
export function todayIn(timezone: string = DEFAULT_TIMEZONE): ISODate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function toISODate(d: Date): ISODate {
  return format(d, "yyyy-MM-dd");
}

export function addDays(date: ISODate, days: number): ISODate {
  return toISODate(dfAddDays(parseISO(date), days));
}

export function addMonths(date: ISODate, months: number): ISODate {
  return toISODate(dfAddMonths(parseISO(date), months));
}

/** Inclusive end date of a membership that starts on `start`. */
export function membershipEndDate(start: ISODate, months: number): ISODate {
  return addDays(addMonths(start, months), -1);
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from));
}

/** Inclusive date-range overlap. */
export function rangesOverlap(
  aStart: ISODate,
  aEnd: ISODate,
  bStart: ISODate,
  bEnd: ISODate,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function formatDate(date?: ISODate | null, pattern = "d MMM yyyy"): string {
  if (!date) return "—";
  return format(parseISO(date), pattern);
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  return format(new Date(iso), "d MMM yyyy, h:mm a");
}

export function monthKey(date: ISODate): string {
  return date.slice(0, 7);
}

export function formatMonthKey(key: string, pattern = "MMM yy"): string {
  return format(parseISO(`${key}-01`), pattern);
}

/** Last `count` month keys ending with the month containing `today`. */
export function recentMonthKeys(today: ISODate, count: number): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(monthKey(addMonths(`${monthKey(today)}-01`, -i)));
  }
  return keys;
}

export function relativeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return format(d, "h:mm a");
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
