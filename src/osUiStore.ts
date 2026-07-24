import { create } from "zustand";
import {
  applyDeveloperPrefs,
  readDeveloperPrefs,
  updateDeveloperPrefs,
  type DeveloperPrefs,
} from "./developerPrefs";
import {
  applySystemPrefs,
  readSystemPrefs,
  updateSystemPrefs,
  type SystemPrefs,
} from "./systemPrefs";

export type NotificationCategory = "system" | "files" | "apps" | "media";

export type BannerDuration = "short" | "standard" | "long";

export type WorkspaceId = 0 | 1 | 2;

export type NotificationPrefs = {
  dndEnabled: boolean;
  dndStart: string;
  dndEnd: string;
  bannerDuration: BannerDuration;
  categories: Record<NotificationCategory, boolean>;
};

type OsUiStore = {
  activeWorkspace: WorkspaceId;
  setActiveWorkspace: (workspace: WorkspaceId) => void;
  notificationCenterOpen: boolean;
  setNotificationCenterOpen: (open: boolean) => void;
  toggleNotificationCenter: () => void;
  controlCenterOpen: boolean;
  setControlCenterOpen: (open: boolean) => void;
  toggleControlCenter: () => void;
  sessionLocked: boolean;
  lockSession: () => void;
  unlockSession: () => void;
  notificationPrefs: NotificationPrefs;
  setNotificationPrefs: (patch: Partial<NotificationPrefs> | ((current: NotificationPrefs) => NotificationPrefs)) => void;
  widgetsCollapsed: boolean;
  setWidgetsCollapsed: (collapsed: boolean) => void;
  developerPrefs: DeveloperPrefs;
  setDeveloperPrefs: (patch: Partial<DeveloperPrefs>) => void;
  systemPrefs: SystemPrefs;
  setSystemPrefs: (patch: Partial<SystemPrefs>) => void;
  /** When set, that window fills the viewport and OS chrome is hidden. */
  immersiveWindowId: string | null;
  enterImmersive: (windowId: string) => void;
  exitImmersive: () => void;
  toggleImmersive: (windowId: string) => void;
};

const initialDeveloperPrefs = readDeveloperPrefs();
applyDeveloperPrefs(initialDeveloperPrefs);
const initialSystemPrefs = readSystemPrefs();
applySystemPrefs(initialSystemPrefs);

const WORKSPACE_KEY = "neko-virt-os.workspace.v1";
const NOTIFY_PREFS_KEY = "neko-virt-os.notification-prefs.v1";
const WIDGETS_KEY = "neko-virt-os.widgets-collapsed.v1";

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  dndEnabled: false,
  dndStart: "22:00",
  dndEnd: "08:00",
  bannerDuration: "standard",
  categories: {
    system: true,
    files: true,
    apps: true,
    media: true,
  },
};

export const BANNER_DURATION_MS: Record<BannerDuration, number> = {
  short: 2000,
  standard: 3500,
  long: 6000,
};

function loadWorkspace(): WorkspaceId {
  try {
    const value = Number(localStorage.getItem(WORKSPACE_KEY));
    return value === 1 || value === 2 ? value : 0;
  } catch {
    return 0;
  }
}

function normalizeNotificationPrefs(value: Partial<NotificationPrefs> & { categories?: Partial<Record<NotificationCategory, boolean>> } = {}): NotificationPrefs {
  const bannerDuration = (["short", "standard", "long"] as const).includes(value.bannerDuration as BannerDuration)
    ? (value.bannerDuration as BannerDuration)
    : DEFAULT_NOTIFICATION_PREFS.bannerDuration;
  return {
    dndEnabled: Boolean(value.dndEnabled),
    dndStart: typeof value.dndStart === "string" && value.dndStart ? value.dndStart : DEFAULT_NOTIFICATION_PREFS.dndStart,
    dndEnd: typeof value.dndEnd === "string" && value.dndEnd ? value.dndEnd : DEFAULT_NOTIFICATION_PREFS.dndEnd,
    bannerDuration,
    categories: {
      system: value.categories?.system !== false,
      files: value.categories?.files !== false,
      apps: value.categories?.apps !== false,
      media: value.categories?.media !== false,
    },
  };
}

function loadPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(NOTIFY_PREFS_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_PREFS;
    return normalizeNotificationPrefs(JSON.parse(raw) as Partial<NotificationPrefs>);
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

function loadWidgetsCollapsed() {
  try {
    return localStorage.getItem(WIDGETS_KEY) === "1";
  } catch {
    return false;
  }
}

export function isWithinDnd(prefs: NotificationPrefs, date = new Date()) {
  if (!prefs.dndEnabled) return false;
  const [startH, startM] = prefs.dndStart.split(":").map(Number);
  const [endH, endM] = prefs.dndEnd.split(":").map(Number);
  const minutes = date.getHours() * 60 + date.getMinutes();
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;
  if (start === end) return true;
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

export const useOsUiStore = create<OsUiStore>((set) => ({
  activeWorkspace: loadWorkspace(),
  setActiveWorkspace: (workspace) => {
    localStorage.setItem(WORKSPACE_KEY, String(workspace));
    set({ activeWorkspace: workspace });
  },
  notificationCenterOpen: false,
  setNotificationCenterOpen: (open) =>
    set((state) => ({
      notificationCenterOpen: open,
      controlCenterOpen: open ? false : state.controlCenterOpen,
    })),
  toggleNotificationCenter: () =>
    set((state) => {
      const open = !state.notificationCenterOpen;
      return {
        notificationCenterOpen: open,
        controlCenterOpen: open ? false : state.controlCenterOpen,
      };
    }),
  controlCenterOpen: false,
  setControlCenterOpen: (open) =>
    set((state) => ({
      controlCenterOpen: open,
      notificationCenterOpen: open ? false : state.notificationCenterOpen,
    })),
  toggleControlCenter: () =>
    set((state) => {
      const open = !state.controlCenterOpen;
      return {
        controlCenterOpen: open,
        notificationCenterOpen: open ? false : state.notificationCenterOpen,
      };
    }),
  sessionLocked: false,
  lockSession: () => {
    // End experimental VR sessions if active (XR shell may cover lock UI).
    void import("./vrDesktop/vrSession").then((m) => m.endVrDesktopSession());
    void import("./vrDesktop/vrDesktopStore").then((m) => m.useVrDesktopStore.getState().closeOverlay());
    void import("./mmdVrShowcase/mmdVrSession").then((m) => m.endMmdVrSession());
    void import("./mmdVrShowcase/mmdVrStore").then((m) => m.useMmdVrStore.getState().closeOverlay());
    set({ sessionLocked: true, controlCenterOpen: false, notificationCenterOpen: false });
  },
  unlockSession: () => set({ sessionLocked: false }),
  notificationPrefs: loadPrefs(),
  setNotificationPrefs: (patch) => set((state) => {
    const nextRaw = typeof patch === "function" ? patch(state.notificationPrefs) : { ...state.notificationPrefs, ...patch };
    const notificationPrefs = normalizeNotificationPrefs(nextRaw);
    localStorage.setItem(NOTIFY_PREFS_KEY, JSON.stringify(notificationPrefs));
    return { notificationPrefs };
  }),
  widgetsCollapsed: loadWidgetsCollapsed(),
  setWidgetsCollapsed: (collapsed) => {
    localStorage.setItem(WIDGETS_KEY, collapsed ? "1" : "0");
    set({ widgetsCollapsed: collapsed });
  },
  developerPrefs: initialDeveloperPrefs,
  setDeveloperPrefs: (patch) => {
    set({ developerPrefs: updateDeveloperPrefs(patch) });
  },
  systemPrefs: initialSystemPrefs,
  setSystemPrefs: (patch) => {
    set({ systemPrefs: updateSystemPrefs(patch) });
  },
  immersiveWindowId: null,
  enterImmersive: (windowId) => set({ immersiveWindowId: windowId }),
  exitImmersive: () => set({ immersiveWindowId: null }),
  toggleImmersive: (windowId) =>
    set((state) => ({
      immersiveWindowId: state.immersiveWindowId === windowId ? null : windowId,
    })),
}));
