import { create } from "zustand";
import { setOwnedLocalStorageItem } from "../system/persistenceGate";
import type { AppId } from "../types";

const DEFAULT_PINNED: AppId[] = [
  "files",
  "notes",
  "browser",
  "calculator",
  "calendar",
  "tasks",
  "timer",
  "palette",
  "mmd-studio",
  "mmd-vr",
  "settings",
  "task-manager",
];

const HIDDEN_DESKTOP_APPS_KEY = "neko-virt-os.desktop-hidden-apps.v1";

function readHiddenDesktopApps(): AppId[] {
  try {
    const raw = localStorage.getItem(HIDDEN_DESKTOP_APPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is AppId => typeof item === "string");
  } catch {
    return [];
  }
}

function saveHiddenDesktopApps(apps: AppId[]) {
  setOwnedLocalStorageItem(HIDDEN_DESKTOP_APPS_KEY, JSON.stringify(apps));
}

type DesktopPinsStore = {
  pinnedDesktopApps: AppId[];
  hiddenDesktopApps: AppId[];
  hideApp: (appId: AppId) => void;
  showAllApps: () => void;
};

export const useDesktopPinsStore = create<DesktopPinsStore>((set) => ({
  pinnedDesktopApps: DEFAULT_PINNED,
  hiddenDesktopApps: readHiddenDesktopApps(),
  hideApp: (appId) =>
    set((state) => {
      if (state.hiddenDesktopApps.includes(appId)) return state;
      const hiddenDesktopApps = [...state.hiddenDesktopApps, appId];
      saveHiddenDesktopApps(hiddenDesktopApps);
      return { hiddenDesktopApps };
    }),
  showAllApps: () => {
    saveHiddenDesktopApps([]);
    set({ hiddenDesktopApps: [] });
  },
}));
