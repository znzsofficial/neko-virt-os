import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { removeOwnedLocalStorageItem, setOwnedLocalStorageItem } from "./system/persistenceGate";
import { nanoid } from "nanoid";
import { apps } from "./apps";
import { appTitleKeys } from "./appText";
import { initialWindows } from "./initialWindows";
import type { TranslationKey } from "./languageStore";
import { useLauncherStore } from "./launcherStore";
import { useOsUiStore } from "./osUiStore";
import { DESKTOP_ICON_POSITIONS_KEY, DESKTOP_LAYOUT_MODE_KEY, normalizeDesktopLayoutMode } from "./system/desktopPrefs";
import { requestSettingsSection } from "./appModules/settings/settingsNavigation";
import { clearAllNoteWindowState, clearNoteWindowState } from "./notesWindowState";
import type { DesktopLayoutMode, DesktopStore, WindowBounds, WindowState, WorkspaceId } from "./types";

export const WINDOW_LAYOUT_STORAGE_KEY = "neko-virt-os.window-layout.v1";
export const SNAP_THRESHOLD = 18;
const TASKBAR_HEIGHT = 82;
const SNAPSHOT_SAVE_DEBOUNCE_MS = 250;
const ICON_POSITIONS_SAVE_DEBOUNCE_MS = 250;

function loadIconPositions(): Record<string, { x: number; y: number }> {
  try {
    const raw = localStorage.getItem(DESKTOP_ICON_POSITIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadDesktopLayoutMode(): DesktopLayoutMode {
  try {
    const raw = localStorage.getItem(DESKTOP_LAYOUT_MODE_KEY);
    return normalizeDesktopLayoutMode(raw);
  } catch {
    return "grid";
  }
}

export function getWindowTitle(window: WindowState, t: (key: TranslationKey) => string) {
  const baseTitle = t(appTitleKeys[window.appId]);
  return window.instanceNumber && window.instanceNumber > 1 ? `${baseTitle} ${window.instanceNumber}` : baseTitle;
}

function assignInstanceNumbers(windows: WindowState[]) {
  const counts = new Map<string, number>();
  for (const win of windows) {
    const instanceNumber = (counts.get(win.appId) ?? 0) + 1;
    counts.set(win.appId, instanceNumber);
    win.instanceNumber = instanceNumber;
  }
}

const initialDesktopSnapshot = loadWindowSnapshot();

export const useDesktopStore = create<DesktopStore>()(
  subscribeWithSelector((set, get) => ({
    windows: initialDesktopSnapshot.windows,
    activeWindowId: initialDesktopSnapshot.activeWindowId,
    launcherOpen: false,
    desktopLayoutMode: loadDesktopLayoutMode(),
    desktopIconPositions: loadIconPositions(),
    openApp: (appId) => {
      if (appId === "mmd-vr") {
        window.location.assign("./mmd-vr.html");
        return null;
      }
      if (appId === "about") {
        requestSettingsSection("about");
      }
      // About is integrated into Settings.
      const resolvedId = appId === "about" ? "settings" : appId;
      const app = apps.find((item) => item.id === resolvedId);
      if (!app) return null;
      useLauncherStore.getState().recordAppLaunch(resolvedId);
      const allowsMultiple = "multiInstance" in app && app.multiInstance;

      const existing = get().windows.find((win) => win.appId === resolvedId);
      if (existing && !allowsMultiple) {
        const existingWorkspace = (existing.workspaceId ?? 0) as WorkspaceId;
        useOsUiStore.getState().setActiveWorkspace(existingWorkspace);
        get().restoreWindow(existing.id);
        get().focusWindow(existing.id);
        set({ launcherOpen: false });
        return existing.id;
      }

      const z = nextZ(get().windows);
      const offset = get().windows.length * 28;
      const windowId = nanoid(8);
      const instanceCount =
        Math.max(0, ...get().windows.filter((win) => win.appId === resolvedId).map((win) => win.instanceNumber ?? 0)) + 1;
      const bounds = snapWindowBounds({
        x: 140 + offset,
        y: 100 + offset,
        width: app.defaultSize.width,
        height: app.defaultSize.height,
      });

      const workspaceId = useOsUiStore.getState().activeWorkspace as WorkspaceId;
      set((state) => ({
        windows: [
          ...state.windows,
          {
            id: windowId,
            appId: resolvedId,
            icon: app.icon,
            instanceNumber: instanceCount,
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            z,
            minimized: false,
            maximized: false,
            workspaceId,
          },
        ],
        activeWindowId: windowId,
        launcherOpen: false,
      }));
      return windowId;
    },
    moveWindowToWorkspace: (id, workspaceId) =>
      set((state) => {
        const target = state.windows.find((win) => win.id === id);
        if (!target) return state;
        if ((target.workspaceId ?? 0) === workspaceId) return state;
        const wasActive = state.activeWindowId === id;
        const windows = state.windows.map((win) => (win.id === id ? { ...win, workspaceId } : win));
        if (!wasActive) return { windows };
        const remaining = windows.filter((win) => win.id !== id && (win.workspaceId ?? 0) === (target.workspaceId ?? 0));
        const top = remaining.reduce<WindowState | null>((best, win) => (!best || win.z > best.z ? win : best), null);
        return { windows, activeWindowId: top?.id ?? null };
      }),
    closeWindow: (id) => {
      const ui = useOsUiStore.getState();
      if (ui.immersiveWindowId === id) ui.exitImmersive();
      const closing = get().windows.find((win) => win.id === id);
      if (closing?.appId === "notes") clearNoteWindowState(closing.id);
      set((state) => ({
        windows: state.windows.filter((win) => win.id !== id),
        activeWindowId: state.activeWindowId === id ? null : state.activeWindowId,
      }));
    },
    focusWindow: (id) =>
      set((state) => ({
        windows: state.windows.map((win) =>
          win.id === id ? { ...win, z: nextZ(state.windows), minimized: false } : win,
        ),
        activeWindowId: id,
      })),
    minimizeWindow: (id) => {
      const ui = useOsUiStore.getState();
      if (ui.immersiveWindowId === id) ui.exitImmersive();
      set((state) => ({
        windows: state.windows.map((win) =>
          win.id === id ? { ...win, minimized: true } : win,
        ),
        activeWindowId: state.activeWindowId === id ? null : state.activeWindowId,
      }));
    },
    restoreWindow: (id) =>
      set((state) => ({
        windows: state.windows.map((win) =>
          win.id === id ? { ...win, minimized: false, z: nextZ(state.windows) } : win,
        ),
        activeWindowId: id,
      })),
    toggleTaskbarWindow: (id) => {
      const window = get().windows.find((win) => win.id === id);
      if (!window) return;
      if (window.minimized) {
        get().restoreWindow(id);
        get().focusWindow(id);
      } else if (get().activeWindowId === id) {
        get().minimizeWindow(id);
      } else {
        get().focusWindow(id);
      }
    },
    toggleMaximize: (id) =>
      set((state) => ({
        windows: state.windows.map((win) => {
          if (win.id !== id) return win;
          if (win.maximized) {
            const restoreBounds = win.restoreBounds ?? {
              x: win.x,
              y: win.y,
              width: win.width,
              height: win.height,
            };
            return { ...win, ...restoreBounds, maximized: false, restoreBounds: undefined, z: nextZ(state.windows) };
          }

          return {
            ...win,
            ...getMaximizedBounds(),
            maximized: true,
            minimized: false,
            restoreBounds: { x: win.x, y: win.y, width: win.width, height: win.height },
            z: nextZ(state.windows),
          };
        }),
        activeWindowId: id,
      })),
    togglePinnedWindowZ: (id) =>
      set((state) => {
        const window = state.windows.find((win) => win.id === id);
        if (!window) return state;
        // Toggle top-most logic: find the maximum z, add 1, or toggle to bottom?
        // In custom Windows-like manager, we can set z-index to nextZ
        return {
          windows: state.windows.map((win) =>
            win.id === id ? { ...win, z: nextZ(state.windows) } : win
          ),
          activeWindowId: id,
        };
      }),
    snapWindow: (id, side) =>
      set((state) => {
        const workArea = getMaximizedBounds();
        const width = Math.floor(workArea.width / 2);
        return {
          windows: state.windows.map((win) => {
            if (win.id !== id) return win;
            return {
              ...win,
              x: side === "left" ? workArea.x : workArea.x + width,
              y: workArea.y,
              width,
              height: workArea.height,
              maximized: false,
              minimized: false,
              restoreBounds: undefined,
              z: nextZ(state.windows),
            };
          }),
          activeWindowId: id,
        };
      }),
    cascadeWindows: () =>
      set((state) => ({
        windows: state.windows.map((win, index) => ({
          ...win,
          x: 64 + index * 34,
          y: 72 + index * 34,
          width: Math.max(480, win.width),
          height: Math.max(320, win.height),
          minimized: false,
          maximized: false,
          restoreBounds: undefined,
          z: index + 1,
        })),
        activeWindowId: state.windows.at(-1)?.id ?? null,
      })),
    tileWindows: () =>
      set((state) => {
        const visibleWindows = state.windows.filter((win) => !win.minimized);
        if (!visibleWindows.length) return state;
        const workArea = getMaximizedBounds();
        const columns = Math.ceil(Math.sqrt(visibleWindows.length));
        const rows = Math.ceil(visibleWindows.length / columns);
        const width = Math.floor(workArea.width / columns);
        const height = Math.floor(workArea.height / rows);
        return {
          windows: state.windows.map((win) => {
            const index = visibleWindows.findIndex((item) => item.id === win.id);
            if (index === -1) return win;
            return {
              ...win,
              x: workArea.x + (index % columns) * width,
              y: workArea.y + Math.floor(index / columns) * height,
              width,
              height,
              maximized: false,
              restoreBounds: undefined,
              z: index + 1,
            };
          }),
          activeWindowId: visibleWindows.at(-1)?.id ?? null,
        };
      }),
    updateWindow: (id, patch) =>
      set((state) => ({
        windows: state.windows.map((win) => (win.id === id ? { ...win, ...patch } : win)),
      })),
    updateDesktopIconPosition: (id, x, y) =>
      set((state) => {
        const nextPositions = { ...state.desktopIconPositions, [id]: { x, y } };
        scheduleIconPositionsSave();
        return { desktopIconPositions: nextPositions };
      }),
    setDesktopLayoutMode: (mode) => {
      setOwnedLocalStorageItem(DESKTOP_LAYOUT_MODE_KEY, mode);
      set({ desktopLayoutMode: mode });
    },
    resetWindowLayout: () => {
      const freshSnapshot = createInitialSnapshot();
      removeOwnedLocalStorageItem(DESKTOP_ICON_POSITIONS_KEY);
      removeOwnedLocalStorageItem(DESKTOP_LAYOUT_MODE_KEY);
      clearAllNoteWindowState();
      set({
        windows: freshSnapshot.windows,
        activeWindowId: freshSnapshot.activeWindowId,
        launcherOpen: false,
        desktopLayoutMode: "grid",
        desktopIconPositions: {},
      });
    },
    toggleLauncher: () => set((state) => ({ launcherOpen: !state.launcherOpen })),
    closeLauncher: () => set({ launcherOpen: false }),
  })),
);

let snapshotTimer: ReturnType<typeof setTimeout> | null = null;
let iconPositionsTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleWindowSnapshot() {
  if (snapshotTimer !== null) return;
  snapshotTimer = setTimeout(() => {
    snapshotTimer = null;
    const { windows, activeWindowId } = useDesktopStore.getState();
    saveWindowSnapshot(windows, activeWindowId);
  }, SNAPSHOT_SAVE_DEBOUNCE_MS);
}

function flushWindowSnapshot() {
  if (snapshotTimer === null) return;
  clearTimeout(snapshotTimer);
  snapshotTimer = null;
  const { windows, activeWindowId } = useDesktopStore.getState();
  saveWindowSnapshot(windows, activeWindowId);
}

function scheduleIconPositionsSave() {
  if (iconPositionsTimer !== null) return;
  iconPositionsTimer = setTimeout(() => {
    iconPositionsTimer = null;
    saveIconPositions(useDesktopStore.getState().desktopIconPositions);
  }, ICON_POSITIONS_SAVE_DEBOUNCE_MS);
}

function flushIconPositions() {
  if (iconPositionsTimer === null) return;
  clearTimeout(iconPositionsTimer);
  iconPositionsTimer = null;
  saveIconPositions(useDesktopStore.getState().desktopIconPositions);
}

useDesktopStore.subscribe(
  (state) => state.windows,
  () => scheduleWindowSnapshot(),
);
useDesktopStore.subscribe(
  (state) => state.activeWindowId,
  () => scheduleWindowSnapshot(),
);

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushWindowSnapshot();
      flushIconPositions();
    }
  });
  window.addEventListener("pagehide", () => {
    flushWindowSnapshot();
    flushIconPositions();
  });
}

export function nextZ(windows: WindowState[]) {
  return Math.max(0, ...windows.map((win) => win.z)) + 1;
}

export function getMaximizedBounds(): WindowBounds {
  return {
    x: 14,
    y: 14,
    width: Math.max(380, globalThis.window.innerWidth - 28),
    height: Math.max(250, globalThis.window.innerHeight - TASKBAR_HEIGHT),
  };
}

export function snapWindowBounds(bounds: WindowBounds): WindowBounds {
  const workArea = getMaximizedBounds();
  const next = { ...bounds };
  const rightEdge = workArea.x + workArea.width;
  const bottomEdge = workArea.y + workArea.height;

  if (Math.abs(next.x - workArea.x) <= SNAP_THRESHOLD) next.x = workArea.x;
  if (Math.abs(next.y - workArea.y) <= SNAP_THRESHOLD) next.y = workArea.y;
  if (Math.abs(next.x + next.width - rightEdge) <= SNAP_THRESHOLD) next.x = rightEdge - next.width;
  if (Math.abs(next.y + next.height - bottomEdge) <= SNAP_THRESHOLD) next.y = bottomEdge - next.height;

  const maxX = Math.max(workArea.x, rightEdge - next.width);
  const maxY = Math.max(workArea.y, bottomEdge - next.height);
  next.x = Math.min(Math.max(next.x, workArea.x), maxX);
  next.y = Math.min(Math.max(next.y, workArea.y), maxY);

  return next;
}

function loadWindowSnapshot() {
  try {
    const rawSnapshot = localStorage.getItem(WINDOW_LAYOUT_STORAGE_KEY);
    if (!rawSnapshot) {
      return createInitialSnapshot();
    }
    const snapshot = JSON.parse(rawSnapshot) as { windows?: WindowState[]; activeWindowId?: string | null };
    if (Array.isArray(snapshot.windows) && snapshot.windows.length === 0) {
      return { windows: [], activeWindowId: null };
    }
    const windows = snapshot.windows?.map(normalizeWindowState).filter(Boolean) as WindowState[] | undefined;
    if (!windows?.length) {
      return createInitialSnapshot();
    }
    assignInstanceNumbers(windows);
    const activeWindowId = windows.some((win) => win.id === snapshot.activeWindowId)
      ? snapshot.activeWindowId ?? null
      : windows[0]?.id ?? null;
    return { windows, activeWindowId };
  } catch {
    return createInitialSnapshot();
  }
}

function createInitialSnapshot() {
  try {
    const windows = initialWindows.map(normalizeWindowState).filter(Boolean) as WindowState[];
    assignInstanceNumbers(windows);
    return { windows, activeWindowId: windows[0]?.id ?? null };
  } catch {
    return { windows: initialWindows, activeWindowId: initialWindows[0]?.id ?? null };
  }
}

function normalizeWindowState(windowState: WindowState): WindowState | null {
  const appId = windowState.appId === "about" ? "settings" : windowState.appId;
  if (windowState.appId === "about") requestSettingsSection("about");
  const app = apps.find((item) => item.id === appId);
  if (!app) return null;
  const hasViewport = typeof globalThis.window !== "undefined";
  const maxBounds = hasViewport
    ? getMaximizedBounds()
    : { width: Number.POSITIVE_INFINITY, height: Number.POSITIVE_INFINITY };
  const normalized = snapWindowBounds({
    width: Math.min(Math.max(380, Number(windowState.width) || app.defaultSize.width), maxBounds.width),
    height: Math.min(Math.max(250, Number(windowState.height) || app.defaultSize.height), maxBounds.height),
    x: Number.isFinite(Number(windowState.x)) ? Number(windowState.x) : 72,
    y: Number.isFinite(Number(windowState.y)) ? Number(windowState.y) : 82,
  });
  const workspaceId = windowState.workspaceId === 1 || windowState.workspaceId === 2 ? windowState.workspaceId : 0;
  return {
    id: windowState.id,
    appId,
    icon: app.icon,
    width: normalized.width,
    height: normalized.height,
    x: normalized.x,
    y: normalized.y,
    z: Number(windowState.z) || 1,
    minimized: Boolean(windowState.minimized),
    maximized: Boolean(windowState.maximized),
    workspaceId,
    restoreBounds: windowState.maximized ? normalizeRestoreBounds(windowState.restoreBounds, maxBounds) : undefined,
  };
}

function normalizeRestoreBounds(bounds: WindowBounds | undefined, maxBounds: { width: number; height: number }): WindowBounds | undefined {
  if (!bounds) return undefined;
  const x = Number(bounds.x);
  const y = Number(bounds.y);
  const width = Number(bounds.width);
  const height = Number(bounds.height);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return undefined;
  return snapWindowBounds({
    x,
    y,
    width: Math.min(Math.max(380, width), maxBounds.width),
    height: Math.min(Math.max(250, height), maxBounds.height),
  });
}

function saveWindowSnapshot(windows: WindowState[], activeWindowId: string | null) {
  try {
    setOwnedLocalStorageItem(WINDOW_LAYOUT_STORAGE_KEY, JSON.stringify({ windows, activeWindowId }));
  } catch (error) {
    console.warn("Failed to save window snapshot", error);
  }
}

function saveIconPositions(positions: Record<string, { x: number; y: number }>) {
  try {
    setOwnedLocalStorageItem(DESKTOP_ICON_POSITIONS_KEY, JSON.stringify(positions));
  } catch (error) {
    console.warn("Failed to save desktop icon positions", error);
  }
}
