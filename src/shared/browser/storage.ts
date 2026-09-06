import { BROWSER_HOME_URL } from "./urls";
import { setOwnedLocalStorageItem } from "../../system/persistenceGate";

export const BROWSER_SESSION_STORAGE_KEY = "neko-virt-os.browser-session.v1";
export const BROWSER_RECENTS_STORAGE_KEY = "neko-virt-os.browser-recents.v1";
export const BROWSER_BOOKMARKS_STORAGE_KEY = "neko-virt-os.browser-bookmarks.v1";
export const BROWSER_CLOSED_TABS_STORAGE_KEY = "neko-virt-os.browser-closed-tabs.v1";
export const BROWSER_SEARCH_ENGINE_STORAGE_KEY = "neko-virt-os.browser-search-engine.v1";

export type BrowserSearchEngine = "duckduckgo" | "google" | "bing";

export type BrowserRecentEntry = {
  title: string;
  url: string;
};

export type BrowserBookmarkEntry = {
  title: string;
  url: string;
  icon?: string;
};

/** Persisted tab shape (iframe flags always reset on load). */
export type BrowserTabRecord = {
  id: string;
  history: string[];
  historyIndex: number;
  address: string;
};

export function createBrowserTabId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createBrowserTabRecord(initialUrl = BROWSER_HOME_URL): BrowserTabRecord {
  return {
    id: createBrowserTabId(),
    history: [initialUrl],
    historyIndex: 0,
    address: initialUrl,
  };
}

export function readBrowserRecents(): BrowserRecentEntry[] {
  try {
    const raw = localStorage.getItem(BROWSER_RECENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentEntry);
  } catch {
    return [];
  }
}

export function writeBrowserRecents(entries: BrowserRecentEntry[]) {
  try {
    setOwnedLocalStorageItem(BROWSER_RECENTS_STORAGE_KEY, JSON.stringify(entries.slice(0, 8)));
  } catch {
    // ignore
  }
}

export function pushBrowserRecent(url: string, title: string): BrowserRecentEntry[] {
  const next = [{ title, url }, ...readBrowserRecents().filter((e) => e.url !== url)].slice(0, 8);
  writeBrowserRecents(next);
  return next;
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function isNavigableTabUrl(url: string): boolean {
  return url === BROWSER_HOME_URL || isHttpUrl(url);
}

function isRecentEntry(value: unknown): value is BrowserRecentEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as BrowserRecentEntry;
  return typeof entry.title === "string" && typeof entry.url === "string" && isHttpUrl(entry.url);
}

function isTabRecord(value: unknown): value is BrowserTabRecord {
  return Boolean(value) && typeof value === "object" && typeof (value as BrowserTabRecord).id === "string";
}

function sanitizeHistory(history: unknown): string[] {
  if (!Array.isArray(history)) return [BROWSER_HOME_URL];
  const entries = history.filter((url): url is string => typeof url === "string" && isNavigableTabUrl(url));
  return entries.length ? entries : [BROWSER_HOME_URL];
}

function sanitizeTabRecord(tab: BrowserTabRecord): BrowserTabRecord {
  const history = sanitizeHistory(tab.history);
  const historyIndex =
    typeof tab.historyIndex === "number"
      ? Math.max(0, Math.min(Math.trunc(tab.historyIndex), history.length - 1))
      : 0;
  const currentUrl = history[historyIndex] ?? BROWSER_HOME_URL;
  return {
    id: tab.id,
    history,
    historyIndex,
    address:
      typeof tab.address === "string" && isNavigableTabUrl(tab.address) ? tab.address : currentUrl,
  };
}

function isBookmarkEntry(value: unknown): value is BrowserBookmarkEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as BrowserBookmarkEntry;
  return typeof entry.title === "string" && isHttpUrl(entry.url);
}

export function readBrowserBookmarksRaw(): BrowserBookmarkEntry[] | null {
  try {
    const raw = localStorage.getItem(BROWSER_BOOKMARKS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const entries = parsed.filter(isBookmarkEntry).map((entry) => ({
      title: entry.title,
      url: entry.url,
      ...(typeof entry.icon === "string" ? { icon: entry.icon } : {}),
    }));
    return entries;
  } catch {
    return null;
  }
}

export function writeBrowserBookmarks(entries: BrowserBookmarkEntry[]) {
  try {
    setOwnedLocalStorageItem(BROWSER_BOOKMARKS_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

export function readClosedTabRecords(): BrowserTabRecord[] {
  try {
    const raw = localStorage.getItem(BROWSER_CLOSED_TABS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTabRecord).map(sanitizeTabRecord);
  } catch {
    return [];
  }
}

export function writeClosedTabRecords(tabs: BrowserTabRecord[]) {
  try {
    setOwnedLocalStorageItem(BROWSER_CLOSED_TABS_STORAGE_KEY, JSON.stringify(tabs.slice(0, 8)));
  } catch {
    // ignore
  }
}

export function readBrowserSessionRecords(): {
  tabs: BrowserTabRecord[];
  activeTabId: string;
} | null {
  try {
    const raw = localStorage.getItem(BROWSER_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as { tabs: BrowserTabRecord[]; activeTabId: string };
    if (!Array.isArray(value.tabs)) return null;
    const tabs = value.tabs.filter(isTabRecord).map(sanitizeTabRecord);
    if (!tabs.length) return null;
    return {
      tabs,
      activeTabId: value.activeTabId,
    };
  } catch {
    return null;
  }
}

export function writeBrowserSessionRecords(tabs: BrowserTabRecord[], activeTabId: string) {
  try {
    setOwnedLocalStorageItem(BROWSER_SESSION_STORAGE_KEY, JSON.stringify({ tabs, activeTabId }));
  } catch {
    // ignore
  }
}

export function readBrowserSearchEngine(): BrowserSearchEngine {
  try {
    const raw = localStorage.getItem(BROWSER_SEARCH_ENGINE_STORAGE_KEY);
    if (raw === "google" || raw === "bing" || raw === "duckduckgo") return raw;
  } catch {
    // ignore
  }
  return "duckduckgo";
}

export function writeBrowserSearchEngine(engine: BrowserSearchEngine) {
  try {
    setOwnedLocalStorageItem(BROWSER_SEARCH_ENGINE_STORAGE_KEY, engine);
  } catch {
    // ignore
  }
}
