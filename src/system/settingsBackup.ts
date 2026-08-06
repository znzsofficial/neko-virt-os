import { z } from "zod";
import type { Language } from "../languageStore";
import {
  NOTIFY_PREFS_KEY,
  WIDGETS_KEY,
  WORKSPACE_KEY,
  normalizeNotificationPrefs,
  type NotificationPrefs,
} from "./notificationPrefs";
import type { DesktopLayoutMode, ThemeSettings, WorkspaceId } from "../types";
import {
  DESKTOP_LAYOUT_MODE_KEY,
  normalizeDesktopLayoutMode,
} from "./desktopPrefs";
import {
  VR_DESKTOP_PREFS_KEY,
  VR_DESKTOP_PREFS_LEGACY_KEY,
  normalizeVrDesktopPrefs,
  type VrDesktopPrefs,
} from "../vrDesktop/vrDesktopPrefs";
import {
  MMD_VR_PREFS_KEY,
  MMD_VR_PREFS_LEGACY_KEY,
  normalizeMmdVrFrameRate,
  normalizeMmdVrPrefs,
  type MmdVrPrefs,
} from "../mmdVrShowcase/mmdVrStore";
import {
  DEVELOPER_PREFS_KEY,
  applyDeveloperPrefs,
  normalizeDeveloperPrefs,
  type DeveloperPrefs,
} from "./developerPrefs";
import { downloadBlob } from "./downloadStore";
import {
  SYSTEM_PREFS_KEY,
  applySystemPrefs,
  normalizeSystemPrefs,
  type SystemPrefs,
} from "./systemPrefs";
import {
  THEME_STORAGE_KEY,
  WALLPAPERS,
  applyThemeSettings,
  normalizeThemeSettings,
} from "./theme";

export const SETTINGS_BACKUP_VERSION = 2 as const;
const LANGUAGE_KEY = "neko-virt-os.language.v1";
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const themeSchema = z.strictObject({
  accentColor: z.enum(["blue", "cyan", "emerald", "mint", "amber", "coral", "rose", "purple", "violet", "slate"]),
  density: z.enum(["compact", "cozy"]),
  theme: z.enum(["system", "light", "dark"]),
  wallpaperId: z.string().refine((value) => value in WALLPAPERS),
  wallpaperLightId: z.string().refine((value) => value in WALLPAPERS),
  wallpaperDarkId: z.string().refine((value) => value in WALLPAPERS),
  wallpaperFit: z.enum(["cover", "contain", "stretch", "tile"]),
  wallpaperOverlay: z.enum(["off", "soft", "standard"]),
});

const notificationPrefsSchema = z.strictObject({
  dndEnabled: z.boolean(),
  dndStart: z.string().regex(TIME_PATTERN),
  dndEnd: z.string().regex(TIME_PATTERN),
  bannerDuration: z.enum(["short", "standard", "long"]),
  categories: z.strictObject({
    system: z.boolean(),
    files: z.boolean(),
    apps: z.boolean(),
    media: z.boolean(),
  }),
});

const developerPrefsSchema = z.strictObject({
  animationQuality: z.enum(["fluid", "power"]),
  showFps: z.boolean(),
  debugBorders: z.boolean(),
  reduceMotion: z.boolean(),
  largeTargets: z.boolean(),
  highContrast: z.boolean(),
});

const systemPrefsSchema = z.strictObject({
  hour12: z.boolean(),
  autoLockMinutes: z.union([z.literal(0), z.literal(5), z.literal(15), z.literal(30)]),
  taskbarShowLabels: z.boolean(),
  taskbarAutoHide: z.boolean(),
});

const vrDesktopPrefsSchema = z.strictObject({
  enabled: z.boolean(),
  softEdges: z.boolean(),
  renderQuality: z.enum(["high", "balanced", "low"]),
  showFps: z.boolean(),
  dprPref: z.enum(["auto", "1", "1.25", "1.5"]),
  panelScalePref: z.enum(["auto", "low", "medium", "high"]),
  frameRatePref: z.enum(["auto", "high", "mid", "low"]),
  antialiasPref: z.enum(["auto", "on", "off"]),
  framebufferScalePref: z.enum(["auto", "0.7", "0.85", "1"]).default("auto"),
  foveationPref: z.enum(["auto", "off", "medium", "high"]).default("auto"),
  floorDetailPref: z.enum(["auto", "low", "medium", "high"]).default("auto"),
  themeColor: z.enum(["blue", "cyan", "purple", "green", "red"]).default("blue"),
});

const mmdVrPrefsSchema = z.strictObject({
  renderQuality: z.enum(["high", "balanced", "low"]),
  showFps: z.boolean(),
  loop: z.boolean(),
  dprPref: z.enum(["auto", "1", "1.25", "1.5"]),
  frameRatePref: z.enum(["auto", "72", "80", "90", "120", "high", "mid", "low"]).transform(normalizeMmdVrFrameRate),
  antialiasPref: z.enum(["auto", "on", "off"]),
  shadowsPref: z.enum(["auto", "on", "off"]),
  gridPref: z.enum(["auto", "on", "off"]),
  walkSpeedPref: z.enum(["auto", "slow", "normal", "fast"]),
  lightPreset: z.enum(["stage", "soft", "contrast", "daylight", "warm", "rim"]),
  framebufferScalePref: z.enum(["auto", "0.7", "0.85", "1"]),
  foveationPref: z.enum(["auto", "off", "medium", "high"]),
  shadowResolutionPref: z.enum(["auto", "low", "medium", "high"]),
  heightOffset: z.number().min(-5).max(50).default(0),
  viewDistance: z.number().min(10).max(100).default(40),
  themeColor: z.enum(["blue", "cyan", "purple", "green", "red"]).default("blue"),
  snapTurnDegrees: z.union([z.literal(15), z.literal(30), z.literal(45)]).default(30),
  exposure: z.number().min(0.7).max(1.3).default(1),
  stageSkyEnabled: z.boolean().default(true),
  stageFogEnabled: z.boolean().default(true),
  stageRimLightEnabled: z.boolean().optional(),
  stageLightPoolEnabled: z.boolean().optional(),
  handTracking: z.boolean().default(true),
  advancedRenderOverrides: z.boolean().default(false),
  detailedPhysicsDiagnostics: z.boolean().default(false),
  panelFollowUser: z.boolean().default(true),
  physicsColliderRadius: z.number().refine((value) => [0.04, 0.08, 0.12, 0.16].includes(value)).default(0.08),
  physicsQuality: z.enum(["low", "medium", "high"]).default("medium"),
  physicsBoneFeedback: z.enum(["soft", "normal", "hard"]).default("normal"),
  physicsColliderFriction: z.enum(["low", "medium", "high"]).default("medium"),
  physicsColliderRestitution: z.enum(["none", "low", "high"]).default("none"),
  physicsHapticLevel: z.enum(["off", "low", "normal"]).default("low"),
  physicsDynamicSelfCollision: z.boolean().default(false),
}).transform((prefs) => normalizeMmdVrPrefs(prefs));

const settingsBackupV2Schema = z.strictObject({
  version: z.literal(SETTINGS_BACKUP_VERSION),
  exportedAt: z.number().int().nonnegative(),
  language: z.enum(["zh", "en"]),
  theme: themeSchema,
  notificationPrefs: notificationPrefsSchema,
  developerPrefs: developerPrefsSchema,
  systemPrefs: systemPrefsSchema,
  workspace: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  widgetsCollapsed: z.boolean(),
  desktopLayoutMode: z.enum(["grid", "free"]),
  vrDesktopPrefs: vrDesktopPrefsSchema,
  mmdVrPrefs: mmdVrPrefsSchema.default(() => normalizeMmdVrPrefs()),
});

const settingsBackupV1Schema = z.looseObject({
  version: z.literal(1),
  exportedAt: z.number().optional(),
  language: z.unknown().optional(),
  theme: z.unknown().optional(),
  notificationPrefs: z.unknown().optional(),
  developerPrefs: z.unknown().optional(),
  systemPrefs: z.unknown().optional(),
  workspace: z.unknown().optional(),
  widgetsCollapsed: z.unknown().optional(),
});

export type SettingsBackup = {
  version: typeof SETTINGS_BACKUP_VERSION;
  exportedAt: number;
  language: Language;
  theme: ThemeSettings;
  notificationPrefs: NotificationPrefs;
  developerPrefs: DeveloperPrefs;
  systemPrefs: SystemPrefs;
  workspace: WorkspaceId;
  widgetsCollapsed: boolean;
  desktopLayoutMode: DesktopLayoutMode;
  vrDesktopPrefs: VrDesktopPrefs;
  mmdVrPrefs: MmdVrPrefs;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function parseJson(storage: StorageLike, key: string): unknown {
  const raw = storage.getItem(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function readLanguage(storage: StorageLike): Language {
  return storage.getItem(LANGUAGE_KEY) === "en" ? "en" : "zh";
}

function readWorkspace(storage: StorageLike): WorkspaceId {
  const value = Number(storage.getItem(WORKSPACE_KEY));
  return value === 1 || value === 2 ? value : 0;
}

function readNotificationPrefs(storage: StorageLike) {
  const value = parseJson(storage, NOTIFY_PREFS_KEY);
  return normalizeNotificationPrefs(value && typeof value === "object" ? value : {});
}

function readVrDesktopPrefs(storage: StorageLike) {
  const value = parseJson(storage, VR_DESKTOP_PREFS_KEY) ?? parseJson(storage, VR_DESKTOP_PREFS_LEGACY_KEY);
  return normalizeVrDesktopPrefs(value && typeof value === "object" ? value : {});
}

function readMmdVrPrefs(storage: StorageLike) {
  const value = parseJson(storage, MMD_VR_PREFS_KEY) ?? parseJson(storage, MMD_VR_PREFS_LEGACY_KEY);
  return normalizeMmdVrPrefs(value && typeof value === "object" ? value : {});
}

export function collectSettingsBackup(storage: StorageLike = localStorage): SettingsBackup {
  const themeValue = parseJson(storage, THEME_STORAGE_KEY);
  const developerValue = parseJson(storage, DEVELOPER_PREFS_KEY);
  const systemValue = parseJson(storage, SYSTEM_PREFS_KEY);
  return {
    version: SETTINGS_BACKUP_VERSION,
    exportedAt: Date.now(),
    language: readLanguage(storage),
    theme: themeValue && typeof themeValue === "object"
      ? normalizeThemeSettings(themeValue as Partial<ThemeSettings>)
      : normalizeThemeSettings(),
    notificationPrefs: readNotificationPrefs(storage),
    developerPrefs: developerValue && typeof developerValue === "object"
      ? normalizeDeveloperPrefs(developerValue as Partial<DeveloperPrefs>)
      : normalizeDeveloperPrefs(),
    systemPrefs: systemValue && typeof systemValue === "object"
      ? normalizeSystemPrefs(systemValue as Partial<SystemPrefs>)
      : normalizeSystemPrefs(),
    workspace: readWorkspace(storage),
    widgetsCollapsed: storage.getItem(WIDGETS_KEY) === "1",
    desktopLayoutMode: normalizeDesktopLayoutMode(storage.getItem(DESKTOP_LAYOUT_MODE_KEY)),
    vrDesktopPrefs: readVrDesktopPrefs(storage),
    mmdVrPrefs: readMmdVrPrefs(storage),
  };
}

function migrateV1(
  value: z.infer<typeof settingsBackupV1Schema>,
  storage: StorageLike,
): SettingsBackup {
  const current = collectSettingsBackup(storage);
  return {
    ...current,
    exportedAt: typeof value.exportedAt === "number" && Number.isFinite(value.exportedAt)
      ? Math.max(0, Math.trunc(value.exportedAt))
      : current.exportedAt,
    language: value.language === "en" || value.language === "zh" ? value.language : current.language,
    theme: value.theme && typeof value.theme === "object"
      ? normalizeThemeSettings({ ...current.theme, ...value.theme as Partial<ThemeSettings> })
      : current.theme,
    notificationPrefs: value.notificationPrefs && typeof value.notificationPrefs === "object"
      ? normalizeNotificationPrefs({
          ...current.notificationPrefs,
          ...value.notificationPrefs,
          categories: {
            ...current.notificationPrefs.categories,
            ...("categories" in value.notificationPrefs && value.notificationPrefs.categories && typeof value.notificationPrefs.categories === "object"
              ? value.notificationPrefs.categories
              : {}),
          },
        })
      : current.notificationPrefs,
    developerPrefs: value.developerPrefs && typeof value.developerPrefs === "object"
      ? normalizeDeveloperPrefs({ ...current.developerPrefs, ...value.developerPrefs })
      : current.developerPrefs,
    systemPrefs: value.systemPrefs && typeof value.systemPrefs === "object"
      ? normalizeSystemPrefs({ ...current.systemPrefs, ...value.systemPrefs })
      : current.systemPrefs,
    workspace: value.workspace === 1 || value.workspace === 2 ? value.workspace : value.workspace === 0 ? 0 : current.workspace,
    widgetsCollapsed: typeof value.widgetsCollapsed === "boolean" ? value.widgetsCollapsed : current.widgetsCollapsed,
  };
}

export function parseSettingsBackup(
  raw: string,
  storage: StorageLike = localStorage,
): SettingsBackup {
  const data: unknown = JSON.parse(raw);
  const version = data && typeof data === "object" && "version" in data
    ? (data as { version?: unknown }).version
    : undefined;
  if (version === 1) return migrateV1(settingsBackupV1Schema.parse(data), storage);
  return settingsBackupV2Schema.parse(data) as SettingsBackup;
}

const targetKeys = [
  LANGUAGE_KEY,
  THEME_STORAGE_KEY,
  NOTIFY_PREFS_KEY,
  DEVELOPER_PREFS_KEY,
  SYSTEM_PREFS_KEY,
  WORKSPACE_KEY,
  WIDGETS_KEY,
  DESKTOP_LAYOUT_MODE_KEY,
  VR_DESKTOP_PREFS_KEY,
  MMD_VR_PREFS_KEY,
] as const;

export function applySettingsBackup(
  backup: SettingsBackup,
  options: { storage?: StorageLike; applyEffects?: boolean } = {},
) {
  const validated = settingsBackupV2Schema.parse(backup) as SettingsBackup;
  const storage = options.storage ?? localStorage;
  const previous = new Map(targetKeys.map((key) => [key, storage.getItem(key)]));
  const values = new Map<string, string>([
    [LANGUAGE_KEY, validated.language],
    [THEME_STORAGE_KEY, JSON.stringify(validated.theme)],
    [NOTIFY_PREFS_KEY, JSON.stringify(validated.notificationPrefs)],
    [DEVELOPER_PREFS_KEY, JSON.stringify(validated.developerPrefs)],
    [SYSTEM_PREFS_KEY, JSON.stringify(validated.systemPrefs)],
    [WORKSPACE_KEY, String(validated.workspace)],
    [WIDGETS_KEY, validated.widgetsCollapsed ? "1" : "0"],
    [DESKTOP_LAYOUT_MODE_KEY, validated.desktopLayoutMode],
    [VR_DESKTOP_PREFS_KEY, JSON.stringify(validated.vrDesktopPrefs)],
    [MMD_VR_PREFS_KEY, JSON.stringify(validated.mmdVrPrefs)],
  ]);

  try {
    for (const key of targetKeys) storage.setItem(key, values.get(key)!);
  } catch (error) {
    for (const key of targetKeys) {
      const value = previous.get(key);
      try {
        if (value == null) storage.removeItem(key);
        else storage.setItem(key, value);
      } catch {
        // Continue restoring the remaining keys, then surface the original failure.
      }
    }
    throw error;
  }

  if (options.applyEffects !== false) {
    document.documentElement.lang = validated.language === "zh" ? "zh-CN" : "en";
    applyThemeSettings(validated.theme);
    applyDeveloperPrefs(validated.developerPrefs);
    applySystemPrefs(validated.systemPrefs);
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
