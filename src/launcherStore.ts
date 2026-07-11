import { create } from "zustand";
import { apps, type AppId } from "./apps";

const LAUNCHER_PINNED_KEY = "neko-virt-os.launcher-pinned.v1";
const LAUNCHER_RECENT_KEY = "neko-virt-os.launcher-recent.v1";

type LauncherStore = {
  pinnedAppIds: AppId[];
  recentAppIds: AppId[];
  togglePinnedApp: (appId: AppId) => void;
  recordAppLaunch: (appId: AppId) => void;
};

function loadIds(storageKey: string, fallback: AppId[]) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as string[];
    return parsed.filter((id): id is AppId => apps.some((app) => app.id === id));
  } catch {
    return fallback;
  }
}

export const useLauncherStore = create<LauncherStore>((set) => ({
  pinnedAppIds: loadIds(LAUNCHER_PINNED_KEY, ["files", "notes", "browser", "terminal"]),
  recentAppIds: loadIds(LAUNCHER_RECENT_KEY, []),
  togglePinnedApp: (appId) =>
    set((state) => {
      const pinnedAppIds = state.pinnedAppIds.includes(appId)
        ? state.pinnedAppIds.filter((id) => id !== appId)
        : [...state.pinnedAppIds, appId];
      localStorage.setItem(LAUNCHER_PINNED_KEY, JSON.stringify(pinnedAppIds));
      return { pinnedAppIds };
    }),
  recordAppLaunch: (appId) =>
    set((state) => {
      const recentAppIds = [appId, ...state.recentAppIds.filter((id) => id !== appId)].slice(0, 8);
      localStorage.setItem(LAUNCHER_RECENT_KEY, JSON.stringify(recentAppIds));
      return { recentAppIds };
    }),
}));
