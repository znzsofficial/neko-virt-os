/** Shared month calendar helpers (Calendar app + Taskbar tray). */

export const WEEKDAY_KEYS = [
  "weekdaySun",
  "weekdayMon",
  "weekdayTue",
  "weekdayWed",
  "weekdayThu",
  "weekdayFri",
  "weekdaySat",
] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

/** `YYYY-MM-DD` for local calendar date. month is 0-based. */
export function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function todayDateKey(now = new Date()): string {
  return dateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

/** 42 cells (6 weeks): day number or null for padding. */
export function buildMonthCells(year: number, month: number): Array<number | null> {
  const monthStart = new Date(year, month, 1);
  const startOffset = monthStart.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - startOffset + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
