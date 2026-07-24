import { beforeEach, describe, expect, it, vi } from "vitest";
import { BROWSER_HOME_URL } from "./urls";
import {
  BROWSER_BOOKMARKS_STORAGE_KEY,
  BROWSER_RECENTS_STORAGE_KEY,
  BROWSER_SESSION_STORAGE_KEY,
  createBrowserTabRecord,
  pushBrowserRecent,
  readBrowserBookmarksRaw,
  readBrowserRecents,
  readBrowserSessionRecords,
  writeBrowserBookmarks,
  writeBrowserRecents,
  writeBrowserSessionRecords,
} from "./storage";

const memory = new Map<string, string>();

const storageMock = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value);
  },
  removeItem: (key: string) => {
    memory.delete(key);
  },
  clear: () => memory.clear(),
};

vi.stubGlobal("localStorage", storageMock);

describe("browser storage", () => {
  beforeEach(() => {
    memory.clear();
  });

  it("pushBrowserRecent dedupes and caps at 8", () => {
    for (let i = 0; i < 10; i += 1) {
      pushBrowserRecent(`https://ex.com/${i}`, `t${i}`);
    }
    const recents = readBrowserRecents();
    expect(recents).toHaveLength(8);
    expect(recents[0]?.url).toBe("https://ex.com/9");
    pushBrowserRecent("https://ex.com/9", "again");
    expect(readBrowserRecents()[0]?.title).toBe("again");
    expect(readBrowserRecents().filter((e) => e.url === "https://ex.com/9")).toHaveLength(1);
  });

  it("writeBrowserRecents clears", () => {
    pushBrowserRecent("https://a.com", "a");
    writeBrowserRecents([]);
    expect(readBrowserRecents()).toEqual([]);
    expect(memory.get(BROWSER_RECENTS_STORAGE_KEY)).toBe("[]");
  });

  it("session round-trip normalizes tabs", () => {
    const tab = createBrowserTabRecord("https://example.com");
    writeBrowserSessionRecords([tab], tab.id);
    const session = readBrowserSessionRecords();
    expect(session?.activeTabId).toBe(tab.id);
    expect(session?.tabs[0]?.history[0]).toBe("https://example.com");
    expect(session?.tabs[0]?.address).toBe("https://example.com");
  });

  it("session recovers empty history", () => {
    memory.set(
      BROWSER_SESSION_STORAGE_KEY,
      JSON.stringify({
        tabs: [{ id: "t1", history: [], historyIndex: 0, address: "" }],
        activeTabId: "t1",
      }),
    );
    const session = readBrowserSessionRecords();
    expect(session?.tabs[0]?.history).toEqual([BROWSER_HOME_URL]);
  });

  it("readBrowserBookmarksRaw filters invalid entries", () => {
    writeBrowserBookmarks([
      { title: "ok", url: "https://ok.com", icon: "i" },
      { title: 1, url: "https://bad.com" } as never,
      { title: "no-url" } as never,
    ]);
    // writeBrowserBookmarks stringifies as-is; re-read through raw after planting garbage
    memory.set(
      BROWSER_BOOKMARKS_STORAGE_KEY,
      JSON.stringify([
        { title: "ok", url: "https://ok.com" },
        { title: 1, url: "https://x.com" },
        { title: "missing" },
        null,
      ]),
    );
    const raw = readBrowserBookmarksRaw();
    expect(raw).toEqual([{ title: "ok", url: "https://ok.com" }]);
  });

  it("readBrowserBookmarksRaw returns null when missing", () => {
    expect(readBrowserBookmarksRaw()).toBeNull();
  });
});
