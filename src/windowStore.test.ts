// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TranslationKey } from "./languageStore";
import { setNoteWindowDirty, isNoteWindowDirty } from "./notesWindowState";
import { pausePersistence, resumePersistence } from "./system/persistenceGate";
import type { WindowState } from "./types";
import { getMaximizedBounds, getWindowTitle, snapWindowBounds, useDesktopStore, WINDOW_LAYOUT_STORAGE_KEY } from "./windowStore";

const t = ((key: string) => `T:${key}`) as unknown as (key: TranslationKey) => string;

let storageMap: Map<string, string>;

beforeEach(() => {
  storageMap = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storageMap.set(key, String(value));
    },
    removeItem: (key: string) => {
      storageMap.delete(key);
    },
    clear: () => storageMap.clear(),
  });
  useDesktopStore.getState().resetWindowLayout();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mkWindow(partial: Partial<WindowState> & Pick<WindowState, "appId">): WindowState {
  return {
    id: "w",
    icon: "",
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    z: 1,
    minimized: false,
    maximized: false,
    ...partial,
  } as WindowState;
}

describe("getWindowTitle", () => {
  it("derives titles from the app id without instance suffix for the first instance", () => {
    expect(getWindowTitle(mkWindow({ appId: "notes", instanceNumber: 1 }), t)).toBe("T:appNotes");
    expect(getWindowTitle(mkWindow({ appId: "notes" }), t)).toBe("T:appNotes");
  });

  it("appends the instance number for multi-instance windows", () => {
    expect(getWindowTitle(mkWindow({ appId: "notes", instanceNumber: 2 }), t)).toBe("T:appNotes 2");
    expect(getWindowTitle(mkWindow({ appId: "notes", instanceNumber: 3 }), t)).toBe("T:appNotes 3");
  });
});

describe("windowStore multi-instance numbering", () => {
  it("never reuses an instance number after closing a middle instance", () => {
    const store = useDesktopStore.getState();
    store.closeWindow("win-notes");

    const a = store.openApp("notes");
    const b = store.openApp("notes");
    const c = store.openApp("notes");
    const numbersOf = () =>
      useDesktopStore.getState().windows.filter((win) => win.appId === "notes").map((win) => win.instanceNumber);
    expect(numbersOf()).toEqual([1, 2, 3]);

    useDesktopStore.getState().closeWindow(b!);
    const d = useDesktopStore.getState().openApp("notes");
    expect(numbersOf()).toEqual([1, 3, 4]);
    expect(numbersOf()).toHaveLength(new Set(numbersOf()).size);

    void a;
    void c;
    void d;
  });
});

describe("windowStore workspace moves", () => {
  it("is a no-op when the target workspace equals the current one", () => {
    const store = useDesktopStore.getState();
    store.closeWindow("win-notes");
    const calc = store.openApp("calculator");
    const files = store.openApp("files");
    useDesktopStore.getState().focusWindow(calc!);
    expect(useDesktopStore.getState().activeWindowId).toBe(calc);

    useDesktopStore.getState().moveWindowToWorkspace(calc!, 0);
    const state = useDesktopStore.getState();
    expect(state.activeWindowId).toBe(calc);
    expect(state.windows.find((win) => win.id === calc)?.workspaceId).toBe(0);
    expect(state.windows).toHaveLength(2);
    void files;
  });

  it("moves the window and promotes the top remaining window when moving across workspaces", () => {
    const store = useDesktopStore.getState();
    store.closeWindow("win-notes");
    const calc = store.openApp("calculator");
    const files = store.openApp("files");
    useDesktopStore.getState().focusWindow(calc!);

    useDesktopStore.getState().moveWindowToWorkspace(calc!, 1);
    const state = useDesktopStore.getState();
    expect(state.windows.find((win) => win.id === calc)?.workspaceId).toBe(1);
    expect(state.activeWindowId).toBe(files);
  });
});

describe("windowStore note window state", () => {
  it("clears dirty flags when a notes window closes", () => {
    setNoteWindowDirty("win-notes", true);
    expect(isNoteWindowDirty("win-notes")).toBe(true);
    useDesktopStore.getState().closeWindow("win-notes");
    expect(isNoteWindowDirty("win-notes")).toBe(false);
  });

  it("clears all note state on layout reset", () => {
    setNoteWindowDirty("orphan-window", true);
    useDesktopStore.getState().resetWindowLayout();
    expect(isNoteWindowDirty("orphan-window")).toBe(false);
  });
});

describe("windowStore snapshot persistence", () => {
  it("persists debounced snapshots without translated titles", () => {
    window.dispatchEvent(new Event("pagehide"));
    vi.useFakeTimers();
    try {
      const store = useDesktopStore.getState();
      store.closeWindow("win-notes");
      store.openApp("notes");

      const before = storageMap.get(WINDOW_LAYOUT_STORAGE_KEY);
      expect(before).not.toBeNull();
      const beforeParsed = JSON.parse(before!) as { windows: Array<{ id: string }> };
      expect(beforeParsed.windows).toHaveLength(1);
      const beforeId = beforeParsed.windows[0].id;

      vi.advanceTimersByTime(300);
      const raw = storageMap.get(WINDOW_LAYOUT_STORAGE_KEY)!;
      const parsed = JSON.parse(raw) as { windows: Array<Record<string, unknown>> };
      expect(parsed.windows).toHaveLength(1);
      expect(parsed.windows[0].id).not.toBe(beforeId);
      for (const win of parsed.windows) {
        expect(win).not.toHaveProperty("title");
        expect(win).toHaveProperty("instanceNumber");
      }
      expect(parsed.windows[0].instanceNumber).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("holds debounced snapshot writes while persistence is paused", () => {
    window.dispatchEvent(new Event("pagehide"));
    vi.useFakeTimers();
    try {
      const store = useDesktopStore.getState();
      store.closeWindow("win-notes");
      store.openApp("notes");
      window.dispatchEvent(new Event("pagehide"));
      const before = storageMap.get(WINDOW_LAYOUT_STORAGE_KEY);
      expect(before).not.toBeNull();
      const beforeIds = (JSON.parse(before!) as { windows: Array<{ id: string }> }).windows.map((win) => win.id);

      void pausePersistence();
      const extra = store.openApp("calculator");
      vi.advanceTimersByTime(300);
      const gated = JSON.parse(storageMap.get(WINDOW_LAYOUT_STORAGE_KEY)!) as { windows: Array<{ id: string }> };
      expect(gated.windows.map((win) => win.id)).toEqual(beforeIds);
      expect(gated.windows.map((win) => win.id)).not.toContain(extra);

      resumePersistence();
      store.focusWindow(extra!);
      window.dispatchEvent(new Event("pagehide"));
      const after = JSON.parse(storageMap.get(WINDOW_LAYOUT_STORAGE_KEY)!) as { windows: Array<{ id: string }> };
      expect(after.windows.map((win) => win.id)).toContain(extra);
    } finally {
      resumePersistence();
      vi.useRealTimers();
    }
  });
});

describe("windowStore legacy snapshot migration", () => {
  it("drops translated titles, reassigns instance numbers, and clamps bounds on restore", async () => {
    vi.resetModules();
    localStorage.setItem(
      WINDOW_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        windows: [
          { id: "w1", appId: "notes", title: "笔记", x: 5000, y: 100, width: 545, height: 410, z: 2, minimized: false, maximized: false, workspaceId: 0 },
          { id: "w2", appId: "about", title: "About", x: 10, y: 10, width: 800, height: 600, z: 1, minimized: false, maximized: true, restoreBounds: { x: 1, y: 2, width: 800, height: 600 } },
          { id: "w3", appId: "bogus-app", title: "X", x: 0, y: 0, width: 400, height: 300, z: 1 },
          { id: "w4", appId: "notes", title: "笔记 7", x: 40, y: 40, width: 545, height: 410, z: 3, minimized: false, maximized: false, workspaceId: 0, instanceNumber: 7 },
        ],
        activeWindowId: "w3",
      }),
    );
    const mod = await import("./windowStore");
    const { windows, activeWindowId } = mod.useDesktopStore.getState();

    expect(windows).toHaveLength(3);
    const w1 = windows.find((win) => win.id === "w1")!;
    expect(w1.instanceNumber).toBe(1);
    expect("title" in w1).toBe(false);
    expect(w1.x).toBeGreaterThanOrEqual(14);
    expect(w1.x).toBeLessThan(1024);

    const w2 = windows.find((win) => win.id === "w2")!;
    expect(w2.appId).toBe("settings");
    expect(w2.maximized).toBe(true);
    expect(w2.restoreBounds).toBeDefined();

    const w4 = windows.find((win) => win.id === "w4")!;
    expect(w4.instanceNumber).toBe(2);
    expect("title" in w4).toBe(false);

    expect(activeWindowId).toBe("w1");
  });
});

describe("snapWindowBounds", () => {
  it("clamps windows back into the viewport", () => {
    const bounds = snapWindowBounds({ x: 5000, y: 5000, width: 800, height: 600 });
    expect(bounds.x).toBeLessThan(globalThis.window.innerWidth);
    expect(bounds.y).toBeLessThan(globalThis.window.innerHeight);
    expect(bounds.x).toBeGreaterThanOrEqual(14);
    expect(bounds.y).toBeGreaterThanOrEqual(14);
  });

  it("snaps to the work area origin within the snap threshold and pins the taskbar height", () => {
    const bounds = snapWindowBounds({ x: 20, y: 20, width: 800, height: 600 });
    expect(bounds.x).toBe(14);
    expect(bounds.y).toBe(14);
    expect(getMaximizedBounds().height).toBe(globalThis.window.innerHeight - 82);
  });
});
