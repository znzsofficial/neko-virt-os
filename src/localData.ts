export type LocalTaskItem = {
  id: string;
  text: string;
  done: boolean;
  due?: string;
  priority?: "low" | "medium" | "high";
};

export type LocalCalendarEvent = {
  id: string;
  date: string;
  title: string;
  time?: string;
};

export type LocalBookmark = {
  title: string;
  url: string;
  icon?: string;
};

const TASKS_KEY = "neko-virt-os.tasks.v2";
const TASKS_LEGACY_KEY = "neko-virt-os.tasks.v1";
const EVENTS_KEY = "neko-virt-os.calendar-events.v1";
const BOOKMARKS_KEY = "neko-virt-os.browser-bookmarks.v1";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export function readLocalTasks(): LocalTaskItem[] {
  const raw = localStorage.getItem(TASKS_KEY) ?? localStorage.getItem(TASKS_LEGACY_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as LocalTaskItem[];
  } catch {
    return [];
  }
}

export function readLocalCalendarEvents(): LocalCalendarEvent[] {
  return readJson<LocalCalendarEvent[]>(EVENTS_KEY, []);
}

export function readLocalBookmarks(): LocalBookmark[] {
  return readJson<LocalBookmark[]>(BOOKMARKS_KEY, []);
}

export function getPendingTasks(limit = 5) {
  return readLocalTasks().filter((task) => !task.done).slice(0, limit);
}

export function getUpcomingEvents(limit = 5) {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return readLocalCalendarEvents()
    .filter((event) => event.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""))
    .slice(0, limit);
}
