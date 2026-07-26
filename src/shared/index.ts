/**
 * Shared domain layer — usable from 2D appModules and VR surfaces.
 * No React UI, no window shell, no R3F.
 */

export {
  STICKY_BOARD_STORAGE_KEY,
  readStickyNotes,
  writeStickyNotes,
  type StickyNote,
} from "./sticky/stickyBoardStorage";

export {
  BROWSER_HOME_URL,
  isBrowserHome,
  normalizeBrowserUrl,
  shortBrowserHost,
} from "./browser/urls";

export {
  DEFAULT_BROWSER_BOOKMARKS,
  LEGACY_BOOKMARK_TITLE_ALIASES,
  LEGACY_BOOKMARK_TITLE_BY_URL,
  type BrowserBookmarkSeed,
} from "./browser/bookmarks";

export {
  BROWSER_BOOKMARKS_STORAGE_KEY,
  BROWSER_CLOSED_TABS_STORAGE_KEY,
  BROWSER_RECENTS_STORAGE_KEY,
  BROWSER_SESSION_STORAGE_KEY,
  createBrowserTabId,
  createBrowserTabRecord,
  pushBrowserRecent,
  readBrowserBookmarksRaw,
  readBrowserRecents,
  readBrowserSessionRecords,
  readClosedTabRecords,
  writeBrowserBookmarks,
  writeBrowserRecents,
  writeBrowserSessionRecords,
  writeClosedTabRecords,
  type BrowserBookmarkEntry,
  type BrowserRecentEntry,
  type BrowserTabRecord,
} from "./browser/storage";

export {
  createLocalPrefsStorage,
  type LocalPrefsOptions,
  type LocalPrefsStorage,
} from "./localPrefs";

export {
  createPanelTexture,
  hitTestByUv,
  paintFpsBadge,
  paintSecondaryButton,
  roundRectPath,
  type PanelPaintContext,
} from "./panelTexture";

export {
  getPendingTasks,
  readTasks,
  writeTasks,
  TASKS_STORAGE_KEY,
  type LocalTaskItem,
  type TaskPriority,
} from "./tasks/storage";

export {
  getUpcomingEvents,
  getNextUpcomingEvent,
  readCalendarEvents,
  writeCalendarEvents,
  CALENDAR_EVENTS_STORAGE_KEY,
  type LocalCalendarEvent,
} from "./calendar/storage";

export {
  WEEKDAY_KEYS,
  buildMonthCells,
  dateKey,
  daysInMonth,
  todayDateKey,
  type WeekdayKey,
} from "./calendar/monthGrid";
