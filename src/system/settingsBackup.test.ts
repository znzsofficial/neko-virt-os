import { describe, expect, it } from "vitest";
import { DEVELOPER_PREFS_KEY } from "./developerPrefs";
import {
  SETTINGS_BACKUP_VERSION,
  applySettingsBackup,
  collectSettingsBackup,
  parseSettingsBackup,
  type SettingsBackup,
} from "./settingsBackup";
import { SYSTEM_PREFS_KEY } from "./systemPrefs";
import { THEME_STORAGE_KEY } from "./theme";
import { DESKTOP_LAYOUT_MODE_KEY } from "./desktopPrefs";
import { NOTIFY_PREFS_KEY, WIDGETS_KEY, WORKSPACE_KEY } from "./notificationPrefs";
import { VR_DESKTOP_PREFS_KEY } from "../vrDesktop/vrDesktopPrefs";
import { MMD_VR_PREFS_KEY } from "../mmdVrShowcase/mmdVrStore";

const LANGUAGE_KEY = "neko-virt-os.language.v1";

function createStorage(initial: Record<string, string> = {}, failAtWrite?: number) {
  const data = new Map(Object.entries(initial));
  let writes = 0;
  return {
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      writes += 1;
      if (writes === failAtWrite) throw new DOMException("Quota exceeded", "QuotaExceededError");
      data.set(key, value);
    },
    removeItem(key: string) {
      data.delete(key);
    },
    entries() {
      return Object.fromEntries(data);
    },
  };
}

function createBackup(): SettingsBackup {
  return {
    version: SETTINGS_BACKUP_VERSION,
    exportedAt: 1_721_000_000_000,
    language: "en",
    theme: {
      accentColor: "rose",
      density: "compact",
      theme: "dark",
      wallpaperId: "forest",
      wallpaperLightId: "alpine-lake",
      wallpaperDarkId: "forest",
      wallpaperFit: "contain",
      wallpaperOverlay: "soft",
    },
    notificationPrefs: {
      dndEnabled: true,
      dndStart: "23:30",
      dndEnd: "07:15",
      bannerDuration: "long",
      categories: { system: true, files: false, apps: true, media: false },
    },
    developerPrefs: {
      animationQuality: "power",
      showFps: true,
      debugBorders: false,
      reduceMotion: true,
      largeTargets: true,
      highContrast: true,
    },
    systemPrefs: {
      hour12: true,
      autoLockMinutes: 15,
      taskbarShowLabels: false,
      taskbarAutoHide: true,
    },
    workspace: 2,
    widgetsCollapsed: true,
    desktopLayoutMode: "free",
    vrDesktopPrefs: {
      enabled: true,
      softEdges: true,
      renderQuality: "high",
      showFps: true,
      dprPref: "1.25",
      panelScalePref: "high",
      frameRatePref: "high",
      antialiasPref: "on",
      framebufferScalePref: "1",
      foveationPref: "medium",
      floorDetailPref: "high",
      themeColor: "cyan",
    },
    mmdVrPrefs: {
      renderQuality: "high",
      showFps: true,
      loop: false,
      dprPref: "1.25",
      frameRatePref: "120",
      antialiasPref: "on",
      shadowsPref: "on",
      gridPref: "off",
      walkSpeedPref: "fast",
      lightPreset: "contrast",
      framebufferScalePref: "1",
      foveationPref: "medium",
      shadowResolutionPref: "high",
      heightOffset: 50,
      viewDistance: 80,
      themeColor: "purple",
      snapTurnDegrees: 45,
      exposure: 1.2,
      stageSkyEnabled: false,
      stageFogEnabled: false,
      stageRimLightEnabled: false,
      stageLightPoolEnabled: false,
      handTracking: true,
      advancedRenderOverrides: true,
      detailedPhysicsDiagnostics: true,
      panelFollowUser: true,
      physicsColliderRadius: 0.12,
      physicsQuality: "high",
      physicsBoneFeedback: "hard",
      physicsColliderFriction: "high",
      physicsColliderRestitution: "low",
      physicsHapticLevel: "normal",
      physicsDynamicSelfCollision: true,
    },
  };
}

describe("settings backup v2", () => {
  it("round-trips every settings-controlled preference", () => {
    const storage = createStorage();
    const backup = createBackup();

    applySettingsBackup(backup, { storage, applyEffects: false });
    const collected = collectSettingsBackup(storage);

    expect({ ...collected, exportedAt: backup.exportedAt }).toEqual(backup);
    expect(storage.getItem(DESKTOP_LAYOUT_MODE_KEY)).toBe("free");
    expect(storage.getItem(VR_DESKTOP_PREFS_KEY)).toContain('"renderQuality":"high"');
    expect(storage.getItem(MMD_VR_PREFS_KEY)).toContain('"shadowResolutionPref":"high"');
    expect(storage.getItem(MMD_VR_PREFS_KEY)).toContain('"heightOffset":50');
    expect(storage.getItem(MMD_VR_PREFS_KEY)).toContain('"snapTurnDegrees":45');
    expect(storage.getItem(MMD_VR_PREFS_KEY)).toContain('"handTracking":true');
  });

  it("rejects malformed fields and unknown v2 keys", () => {
    const backup = createBackup();
    expect(() => parseSettingsBackup(JSON.stringify({
      ...backup,
      notificationPrefs: { ...backup.notificationPrefs, dndStart: "25:99" },
    }), createStorage())).toThrow();
    expect(() => parseSettingsBackup(JSON.stringify({ ...backup, unexpected: true }), createStorage())).toThrow();
    expect(() => parseSettingsBackup(JSON.stringify({ ...backup, version: 3 }), createStorage())).toThrow();
  });

  it("defaults theme colors for backups created before color settings existed", () => {
    const backup = createBackup();
    const { themeColor: _desktopTheme, ...vrDesktopPrefs } = backup.vrDesktopPrefs;
    const {
      themeColor: _mmdTheme,
      snapTurnDegrees: _snapTurnDegrees,
      exposure: _exposure,
      stageSkyEnabled: _stageSkyEnabled,
      stageFogEnabled: _stageFogEnabled,
      stageRimLightEnabled: _stageRimLightEnabled,
      stageLightPoolEnabled: _stageLightPoolEnabled,
      ...mmdVrPrefs
    } = backup.mmdVrPrefs;
    const parsed = parseSettingsBackup(JSON.stringify({ ...backup, vrDesktopPrefs, mmdVrPrefs }), createStorage());

    expect(parsed.vrDesktopPrefs.themeColor).toBe("blue");
    expect(parsed.mmdVrPrefs.themeColor).toBe("blue");
    expect(parsed.mmdVrPrefs.snapTurnDegrees).toBe(30);
    expect(parsed.mmdVrPrefs.exposure).toBe(1);
    expect(parsed.mmdVrPrefs).toMatchObject({
      stageSkyEnabled: true,
      stageFogEnabled: true,
      stageRimLightEnabled: true,
      stageLightPoolEnabled: true,
    });
  });

  it("round-trips independent MMD VR visual switches", () => {
    const backup = createBackup();
    backup.mmdVrPrefs.stageRimLightEnabled = false;
    backup.mmdVrPrefs.stageLightPoolEnabled = true;

    const parsed = parseSettingsBackup(JSON.stringify(backup), createStorage());

    expect(parsed.mmdVrPrefs).toMatchObject({
      lightPreset: "contrast",
      stageRimLightEnabled: false,
      stageLightPoolEnabled: true,
    });
  });

  it("migrates legacy MMD VR refresh tiers without changing VR Desktop preferences", () => {
    const backup = createBackup();
    const {
      advancedRenderOverrides: _advancedRenderOverrides,
      detailedPhysicsDiagnostics: _detailedPhysicsDiagnostics,
      ...mmdVrPrefs
    } = backup.mmdVrPrefs;
    const parsed = parseSettingsBackup(JSON.stringify({
      ...backup,
      mmdVrPrefs: { ...mmdVrPrefs, frameRatePref: "mid" },
    }), createStorage());

    expect(parsed.mmdVrPrefs.frameRatePref).toBe("90");
    expect(parsed.mmdVrPrefs.advancedRenderOverrides).toBe(false);
    expect(parsed.mmdVrPrefs.detailedPhysicsDiagnostics).toBe(false);
    expect(parsed.vrDesktopPrefs.frameRatePref).toBe("high");
  });

  it("migrates v1 by merging missing fields from current preferences", () => {
    const current = createBackup();
    const storage = createStorage();
    applySettingsBackup(current, { storage, applyEffects: false });

    const migrated = parseSettingsBackup(JSON.stringify({
      version: 1,
      exportedAt: 100,
      language: "zh",
      notificationPrefs: { categories: { system: false } },
      systemPrefs: { hour12: false, autoLockMinutes: 5 },
    }), storage);

    expect(migrated.version).toBe(2);
    expect(migrated.language).toBe("zh");
    expect(migrated.systemPrefs.autoLockMinutes).toBe(5);
    expect(migrated.notificationPrefs.categories.system).toBe(false);
    expect(migrated.notificationPrefs.categories.files).toBe(current.notificationPrefs.categories.files);
    expect(migrated.desktopLayoutMode).toBe("free");
    expect(migrated.vrDesktopPrefs).toEqual(current.vrDesktopPrefs);
  });

  it("rolls back all target keys when a write fails", () => {
    const original = {
      [LANGUAGE_KEY]: "zh",
      [THEME_STORAGE_KEY]: "old-theme",
      [NOTIFY_PREFS_KEY]: "old-notifications",
      [DEVELOPER_PREFS_KEY]: "old-developer",
      [SYSTEM_PREFS_KEY]: "old-system",
      [WORKSPACE_KEY]: "0",
      [WIDGETS_KEY]: "0",
      [DESKTOP_LAYOUT_MODE_KEY]: "grid",
      [VR_DESKTOP_PREFS_KEY]: "old-vr",
      [MMD_VR_PREFS_KEY]: "old-mmd-vr",
    };
    const storage = createStorage(original, 5);

    expect(() => applySettingsBackup(createBackup(), { storage, applyEffects: false })).toThrow("Quota exceeded");
    expect(storage.entries()).toEqual(original);
  });
});
