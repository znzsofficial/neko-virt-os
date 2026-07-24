/**
 * Thin façade for shell widgets / command palette.
 * Domain storage lives under `shared/tasks`, `shared/calendar`, `shared/browser`.
 */
export {
  getPendingTasks,
  readTasks as readLocalTasks,
  type LocalTaskItem,
  type TaskPriority,
} from "../shared/tasks/storage";

export {
  getUpcomingEvents,
  readCalendarEvents as readLocalCalendarEvents,
  type LocalCalendarEvent,
} from "../shared/calendar/storage";

import {
  readBrowserBookmarksRaw,
  type BrowserBookmarkEntry,
} from "../shared/browser/storage";

export type LocalBookmark = {
  title: string;
  url: string;
  icon?: string;
};

export function readLocalBookmarks(): LocalBookmark[] {
  const raw = readBrowserBookmarksRaw();
  if (!raw) return [];
  return raw.map((b: BrowserBookmarkEntry) => ({
    title: b.title,
    url: b.url,
    icon: b.icon,
  }));
}
