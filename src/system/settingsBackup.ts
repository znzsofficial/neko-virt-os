import {
  DEVELOPER_PREFS_KEY,
  applyDeveloperPrefs,
  normalizeDeveloperPrefs,
  type DeveloperPrefs,
} from "./developerPrefs";
import { downloadBlob } from "./downloadStore";
import type { Language } from "../languageStore";
import {
  SYSTEM_PREFS_KEY,
  applySystemPrefs,
  normalizeSystemPrefs,
  type SystemPrefs,
} from "./systemPrefs";
import { THEME_STORAGE_KEY, applyThemeSettings, normalizeThemeSettings } from "./theme";
import type { ThemeSettings } from "../types";

export const SETTINGS_BACKUP_VERSION = 1 as const;

export type SettingsBackup = {
  version: typeof SETTINGS_BACKUP_VERSION;
  exportedAt: number;
  language?: Language;
  theme?: ThemeSettings;
  notificationPrefs?: Record<string, unknown>;
  developerPrefs?: DeveloperPrefs;
  systemPrefs?: SystemPrefs;
  workspace?: number;
  widgetsCollapsed?: boolean;
};

const LANGUAGE_KEY = "neko-virt-os.language.v1";
const NOTIFY_KEY = "neko-virt-os.notification-prefs.v1";
const WORKSPACE_KEY = "neko-virt-os.workspace.v1";
const WIDGETS_KEY = "neko-virt-os.widgets-collapsed.v1";

function readJson<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function collectSettingsBackup(): SettingsBackup {
  return {
    version: SETTINGS_BACKUP_VERSION,
    exportedAt: Date.now(),
    language: readJson<Language>(LANGUAGE_KEY),
    theme: readJson<ThemeSettings>(THEME_STORAGE_KEY),
    notificationPrefs: readJson(NOTIFY_KEY),
    developerPrefs: readJson(DEVELOPER_PREFS_KEY),
    systemPrefs: readJson(SYSTEM_PREFS_KEY),
    workspace: (() => {
      const raw = localStorage.getItem(WORKSPACE_KEY);
      return raw != null ? Number(raw) : undefined;
    })(),
    widgetsCollapsed: localStorage.getItem(WIDGETS_KEY) === "1",
  };
}

export function parseSettingsBackup(raw: string): SettingsBackup {
  const data = JSON.parse(raw) as SettingsBackup;
  if (!data || data.version !== SETTINGS_BACKUP_VERSION) {
    throw new Error("unsupported-backup");
  }
  return data;
}

export function applySettingsBackup(backup: SettingsBackup) {
  if (backup.language === "zh" || backup.language === "en") {
    localStorage.setItem(LANGUAGE_KEY, backup.language);
  }
  if (backup.theme) {
    const theme = normalizeThemeSettings(backup.theme);
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
    applyThemeSettings(theme);
  }
  if (backup.notificationPrefs) {
    // Persist raw; osUiStore reloads + normalizes after page refresh.
    localStorage.setItem(NOTIFY_KEY, JSON.stringify(backup.notificationPrefs));
  }
  if (backup.developerPrefs) {
    const developer = normalizeDeveloperPrefs(backup.developerPrefs);
    localStorage.setItem(DEVELOPER_PREFS_KEY, JSON.stringify(developer));
    applyDeveloperPrefs(developer);
  }
  if (backup.systemPrefs) {
    const system = normalizeSystemPrefs(backup.systemPrefs);
    localStorage.setItem(SYSTEM_PREFS_KEY, JSON.stringify(system));
    applySystemPrefs(system);
  }
  if (backup.workspace === 0 || backup.workspace === 1 || backup.workspace === 2) {
    localStorage.setItem(WORKSPACE_KEY, String(backup.workspace));
  }
  if (typeof backup.widgetsCollapsed === "boolean") {
    localStorage.setItem(WIDGETS_KEY, backup.widgetsCollapsed ? "1" : "0");
  }
}

export function downloadSettingsBackup() {
  const payload = collectSettingsBackup();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  downloadBlob({
    blob,
    name: `neko-virt-os-settings-${new Date().toISOString().slice(0, 10)}.json`,
    source: "Settings",
    register: false,
    revokeAfterMs: 1_000,
  });
}
