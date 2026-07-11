import { create } from "zustand";
import { nanoid } from "nanoid";
import { apps } from "./apps";
import { initialWindows } from "./initialWindows";
import { useLanguageStore } from "./languageStore";
import { useLauncherStore } from "./launcherStore";
import { useOsUiStore } from "./osUiStore";
import type { DesktopLayoutMode, DesktopStore, WindowBounds, WindowState, WorkspaceId } from "./types";

export const WINDOW_LAYOUT_STORAGE_KEY = "neko-virt-os.window-layout.v1";
export const SNAP_THRESHOLD = 18;

const DESKTOP_ICON_POSITIONS_KEY = "neko-virt-os.desktop-icons.v1";
const DESKTOP_LAYOUT_MODE_KEY = "neko-virt-os.desktop-layout-mode.v1";

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
    return raw === "free" || raw === "grid" ? raw : "grid";
  } catch {
    return "grid";
  }
}

const initialDesktopSnapshot = loadWindowSnapshot();

export const useDesktopStore = create<DesktopStore>((set, get) => ({
  windows: initialDesktopSnapshot.windows,
  activeWindowId: initialDesktopSnapshot.activeWindowId,
  launcherOpen: false,
  desktopLayoutMode: loadDesktopLayoutMode(),
  desktopIconPositions: loadIconPositions(),
  openApp: (appId) => {
    const app = apps.find((item) => item.id === appId);
    if (!app) return null;
    const t = useLanguageStore.getState().t;
    useLauncherStore.getState().recordAppLaunch(appId);
    const allowsMultiple = "multiInstance" in app && app.multiInstance;

    const existing = get().windows.find((win) => win.appId === appId);
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
    const instanceCount = get().windows.filter((win) => win.appId === appId).length + 1;
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
          appId,
          title: allowsMultiple && instanceCount > 1 ? `${t(app.titleKey)} ${instanceCount}` : t(app.titleKey),
          icon: app.icon,
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
    set((state) => ({
      windows: state.windows.map((win) => win.id === id ? { ...win, workspaceId } : win),
      activeWindowId: state.activeWindowId === id ? null : state.activeWindowId,
    })),
  closeWindow: (id) =>
    set((state) => ({
      windows: state.windows.filter((win) => win.id !== id),
      activeWindowId: state.activeWindowId === id ? null : state.activeWindowId,
    })),
  focusWindow: (id) =>
    set((state) => ({
      windows: state.windows.map((win) =>
        win.id === id ? { ...win, z: nextZ(state.windows), minimized: false } : win,
      ),
      activeWindowId: id,
    })),
  minimizeWindow: (id) =>
    set((state) => ({
      windows: state.windows.map((win) =>
        win.id === id ? { ...win, minimized: true } : win,
      ),
      activeWindowId: state.activeWindowId === id ? null : state.activeWindowId,
    })),
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
      localStorage.setItem(DESKTOP_ICON_POSITIONS_KEY, JSON.stringify(nextPositions));
      return { desktopIconPositions: nextPositions };
    }),
  setDesktopLayoutMode: (mode) => {
    localStorage.setItem(DESKTOP_LAYOUT_MODE_KEY, mode);
    set({ desktopLayoutMode: mode });
  },
  resetWindowLayout: () => {
    localStorage.removeItem(WINDOW_LAYOUT_STORAGE_KEY);
    localStorage.removeItem(DESKTOP_ICON_POSITIONS_KEY);
    localStorage.removeItem(DESKTOP_LAYOUT_MODE_KEY);
    set({ windows: initialWindows, activeWindowId: "win-files", launcherOpen: false, desktopLayoutMode: "grid", desktopIconPositions: {} });
  },
  toggleLauncher: () => set((state) => ({ launcherOpen: !state.launcherOpen })),
  closeLauncher: () => set({ launcherOpen: false }),
}));

useDesktopStore.subscribe((state) => {
  saveWindowSnapshot(state.windows, state.activeWindowId);
});

export function nextZ(windows: WindowState[]) {
  return Math.max(0, ...windows.map((win) => win.z)) + 1;
}

export function getMaximizedBounds(): WindowBounds {
  return {
    x: 14,
    y: 14,
    width: Math.max(380, globalThis.window.innerWidth - 28),
    height: Math.max(250, globalThis.window.innerHeight - 82),
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
    if (!rawSnapshot) return { windows: initialWindows, activeWindowId: "win-files" };
    const snapshot = JSON.parse(rawSnapshot) as { windows?: WindowState[]; activeWindowId?: string | null };
    if (Array.isArray(snapshot.windows) && snapshot.windows.length === 0) {
      return { windows: [], activeWindowId: null };
    }
    const windows = snapshot.windows?.map(normalizeWindowState).filter(Boolean) as WindowState[] | undefined;
    if (!windows?.length) return { windows: initialWindows, activeWindowId: "win-files" };
    const activeWindowId = windows.some((win) => win.id === snapshot.activeWindowId)
      ? snapshot.activeWindowId ?? null
      : windows[0].id;
    return { windows, activeWindowId };
  } catch {
    return { windows: initialWindows, activeWindowId: "win-files" };
  }
}

function normalizeWindowState(windowState: WindowState): WindowState | null {
  const app = apps.find((item) => item.id === windowState.appId);
  if (!app) return null;
  const t = useLanguageStore.getState().t;
  const normalized = snapWindowBounds({
    width: Math.max(380, Number(windowState.width) || app.defaultSize.width),
    height: Math.max(250, Number(windowState.height) || app.defaultSize.height),
    x: Number.isFinite(Number(windowState.x)) ? Number(windowState.x) : 72,
    y: Number.isFinite(Number(windowState.y)) ? Number(windowState.y) : 82,
  });
  const workspaceId = windowState.workspaceId === 1 || windowState.workspaceId === 2 ? windowState.workspaceId : 0;
  return {
    ...windowState,
    title: t(app.titleKey),
    icon: app.icon,
    width: normalized.width,
    height: normalized.height,
    x: normalized.x,
    y: normalized.y,
    z: Number(windowState.z) || 1,
    minimized: Boolean(windowState.minimized),
    maximized: Boolean(windowState.maximized),
    workspaceId,
  };
}

function saveWindowSnapshot(windows: WindowState[], activeWindowId: string | null) {
  localStorage.setItem(WINDOW_LAYOUT_STORAGE_KEY, JSON.stringify({ windows, activeWindowId }));
}
