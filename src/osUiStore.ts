import { create } from "zustand";
import {
  applyDeveloperPrefs,
  readDeveloperPrefs,
  updateDeveloperPrefs,
  type DeveloperPrefs,
} from "./developerPrefs";

export type NotificationCategory = "system" | "files" | "apps" | "media";

export type WorkspaceId = 0 | 1 | 2;

type NotificationPrefs = {
  dndEnabled: boolean;
  dndStart: string;
  dndEnd: string;
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
  setNotificationPrefs: (patch: Partial<NotificationPrefs>) => void;
  widgetsCollapsed: boolean;
  setWidgetsCollapsed: (collapsed: boolean) => void;
  developerPrefs: DeveloperPrefs;
  setDeveloperPrefs: (patch: Partial<DeveloperPrefs>) => void;
  /** When set, that window fills the viewport and OS chrome is hidden. */
  immersiveWindowId: string | null;
  enterImmersive: (windowId: string) => void;
  exitImmersive: () => void;
  toggleImmersive: (windowId: string) => void;
};

const initialDeveloperPrefs = readDeveloperPrefs();
applyDeveloperPrefs(initialDeveloperPrefs);

const WORKSPACE_KEY = "neko-virt-os.workspace.v1";
const NOTIFY_PREFS_KEY = "neko-virt-os.notification-prefs.v1";
const WIDGETS_KEY = "neko-virt-os.widgets-collapsed.v1";

function loadWorkspace(): WorkspaceId {
  try {
    const value = Number(localStorage.getItem(WORKSPACE_KEY));
    return value === 1 || value === 2 ? value : 0;
  } catch {
    return 0;
  }
}

function loadPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(NOTIFY_PREFS_KEY);
    if (!raw) return { dndEnabled: false, dndStart: "22:00", dndEnd: "08:00" };
    return { dndEnabled: false, dndStart: "22:00", dndEnd: "08:00", ...JSON.parse(raw) };
  } catch {
    return { dndEnabled: false, dndStart: "22:00", dndEnd: "08:00" };
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
  lockSession: () => set({ sessionLocked: true, controlCenterOpen: false, notificationCenterOpen: false }),
  unlockSession: () => set({ sessionLocked: false }),
  notificationPrefs: loadPrefs(),
  setNotificationPrefs: (patch) => set((state) => {
    const notificationPrefs = { ...state.notificationPrefs, ...patch };
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
  immersiveWindowId: null,
  enterImmersive: (windowId) => set({ immersiveWindowId: windowId }),
  exitImmersive: () => set({ immersiveWindowId: null }),
  toggleImmersive: (windowId) =>
    set((state) => ({
      immersiveWindowId: state.immersiveWindowId === windowId ? null : windowId,
    })),
}));
