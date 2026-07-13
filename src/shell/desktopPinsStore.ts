import { create } from "zustand";
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
  "settings",
  "task-manager",
  "about",
];

type DesktopPinsStore = {
  pinnedDesktopApps: AppId[];
  hiddenDesktopApps: AppId[];
  hideApp: (appId: AppId) => void;
  showAllApps: () => void;
  setPinnedDesktopApps: (apps: AppId[]) => void;
};

export const useDesktopPinsStore = create<DesktopPinsStore>((set) => ({
  pinnedDesktopApps: DEFAULT_PINNED,
  hiddenDesktopApps: [],
  hideApp: (appId) =>
    set((state) => ({
      hiddenDesktopApps: state.hiddenDesktopApps.includes(appId)
        ? state.hiddenDesktopApps
        : [...state.hiddenDesktopApps, appId],
    })),
  showAllApps: () => set({ hiddenDesktopApps: [] }),
  setPinnedDesktopApps: (apps) => set({ pinnedDesktopApps: apps }),
}));
