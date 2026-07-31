import { todayDateKey } from "./monthGrid";

export const CALENDAR_EVENTS_STORAGE_KEY = "neko-virt-os.calendar-events.v1";

export type LocalCalendarEvent = {
  id: string;
  date: string;
  title: string;
  time?: string;
};

function normalizeEvents(raw: unknown): LocalCalendarEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((event) => ({
      id: String(event.id ?? ""),
      date: String(event.date ?? ""),
      title: String(event.title ?? ""),
      time: typeof event.time === "string" && event.time ? event.time : undefined,
    }))
    .filter((event) => event.id && event.date && event.title);
}

/** Historical format: bare JSON array. */
export function readCalendarEvents(): LocalCalendarEvent[] {
  try {
    const raw = localStorage.getItem(CALENDAR_EVENTS_STORAGE_KEY);
    if (!raw) return [];
    return normalizeEvents(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeCalendarEvents(events: LocalCalendarEvent[]) {
  try {
    localStorage.setItem(CALENDAR_EVENTS_STORAGE_KEY, JSON.stringify(events));
  } catch {
    // ignore
  }
}

export function getUpcomingEvents(limit = 5): LocalCalendarEvent[] {
  const todayKey = todayDateKey();
  return readCalendarEvents()
    .filter((event) => event.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""))
    .slice(0, limit);
}

export function getNextUpcomingEvent(now = new Date()): LocalCalendarEvent | null {
  const todayKey = todayDateKey(now);
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return readCalendarEvents()
    .filter((event) => event.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""))
    .find((event) => (
      event.date > todayKey || event.date === todayKey && (!event.time || event.time >= nowTime)
    )) ?? null;
}
