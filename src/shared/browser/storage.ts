import { BROWSER_HOME_URL } from "./urls";

export const BROWSER_SESSION_STORAGE_KEY = "neko-virt-os.browser-session.v1";
export const BROWSER_RECENTS_STORAGE_KEY = "neko-virt-os.browser-recents.v1";
export const BROWSER_BOOKMARKS_STORAGE_KEY = "neko-virt-os.browser-bookmarks.v1";
export const BROWSER_CLOSED_TABS_STORAGE_KEY = "neko-virt-os.browser-closed-tabs.v1";

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
    return raw ? (JSON.parse(raw) as BrowserRecentEntry[]) : [];
  } catch {
    return [];
  }
}

export function writeBrowserRecents(entries: BrowserRecentEntry[]) {
  try {
    localStorage.setItem(BROWSER_RECENTS_STORAGE_KEY, JSON.stringify(entries.slice(0, 8)));
  } catch {
    // ignore
  }
}

export function pushBrowserRecent(url: string, title: string): BrowserRecentEntry[] {
  const next = [{ title, url }, ...readBrowserRecents().filter((e) => e.url !== url)].slice(0, 8);
  writeBrowserRecents(next);
  return next;
}

function isBookmarkEntry(value: unknown): value is BrowserBookmarkEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as BrowserBookmarkEntry;
  return typeof entry.title === "string" && typeof entry.url === "string" && entry.url.length > 0;
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
    localStorage.setItem(BROWSER_BOOKMARKS_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

export function readClosedTabRecords(): BrowserTabRecord[] {
  try {
    const raw = localStorage.getItem(BROWSER_CLOSED_TABS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BrowserTabRecord[]) : [];
  } catch {
    return [];
  }
}

export function writeClosedTabRecords(tabs: BrowserTabRecord[]) {
  try {
    localStorage.setItem(BROWSER_CLOSED_TABS_STORAGE_KEY, JSON.stringify(tabs.slice(0, 8)));
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
    if (!Array.isArray(value.tabs) || !value.tabs.length) return null;
    return {
      tabs: value.tabs.map((tab) => ({
        id: tab.id,
        history: Array.isArray(tab.history) && tab.history.length ? tab.history : [BROWSER_HOME_URL],
        historyIndex:
          typeof tab.historyIndex === "number"
            ? Math.max(0, Math.min(tab.historyIndex, (tab.history?.length ?? 1) - 1))
            : 0,
        address:
          typeof tab.address === "string"
            ? tab.address
            : tab.history?.[tab.historyIndex] ?? BROWSER_HOME_URL,
      })),
      activeTabId: value.activeTabId,
    };
  } catch {
    return null;
  }
}

export function writeBrowserSessionRecords(tabs: BrowserTabRecord[], activeTabId: string) {
  try {
    localStorage.setItem(BROWSER_SESSION_STORAGE_KEY, JSON.stringify({ tabs, activeTabId }));
  } catch {
    // ignore
  }
}
