import { setOwnedLocalStorageItem } from "./persistenceGate";

export type AutoLockMinutes = 0 | 5 | 15 | 30;

export type SystemPrefs = {
  hour12: boolean;
  autoLockMinutes: AutoLockMinutes;
  taskbarShowLabels: boolean;
  taskbarAutoHide: boolean;
};

export const SYSTEM_PREFS_KEY = "neko-virt-os.system-prefs.v1";

export const DEFAULT_SYSTEM_PREFS: SystemPrefs = {
  hour12: false,
  autoLockMinutes: 0,
  taskbarShowLabels: true,
  taskbarAutoHide: false,
};

export function normalizeSystemPrefs(value: Partial<SystemPrefs> = {}): SystemPrefs {
  const autoLockMinutes = ([0, 5, 15, 30] as const).includes(value.autoLockMinutes as AutoLockMinutes)
    ? (value.autoLockMinutes as AutoLockMinutes)
    : DEFAULT_SYSTEM_PREFS.autoLockMinutes;
  return {
    hour12: Boolean(value.hour12),
    autoLockMinutes,
    taskbarShowLabels: value.taskbarShowLabels !== false,
    taskbarAutoHide: Boolean(value.taskbarAutoHide),
  };
}

export function applySystemPrefs(prefs: SystemPrefs) {
  const root = document.documentElement;
  root.setAttribute("data-taskbar-labels", prefs.taskbarShowLabels ? "on" : "off");
  root.setAttribute("data-taskbar-autohide", prefs.taskbarAutoHide ? "on" : "off");
}

export function readSystemPrefs(): SystemPrefs {
  try {
    const raw = localStorage.getItem(SYSTEM_PREFS_KEY);
    return raw ? normalizeSystemPrefs(JSON.parse(raw) as Partial<SystemPrefs>) : DEFAULT_SYSTEM_PREFS;
  } catch {
    return DEFAULT_SYSTEM_PREFS;
  }
}

export function updateSystemPrefs(patch: Partial<SystemPrefs>): SystemPrefs {
  const next = normalizeSystemPrefs({ ...readSystemPrefs(), ...patch });
  try {
    setOwnedLocalStorageItem(SYSTEM_PREFS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  applySystemPrefs(next);
  return next;
}

export function formatClockTime(date: Date, hour12: boolean, withSeconds = false) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" as const } : {}),
    hour12,
  });
}
