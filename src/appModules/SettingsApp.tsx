import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { appConfirm } from "../dialogStore";
import { useFsStore } from "../fs";
import { useLanguageStore, type TranslationKey } from "../languageStore";
import {
  collectNetworkSnapshot,
  formatEffectiveType,
  subscribeNetworkChange,
  type NetworkSnapshot,
} from "../networkInfo";
import { useNotificationStore } from "../notificationStore";
import { APP_VERSION, OPEN_SOURCE_PACKAGES } from "../openSourceLicenses";
import {
  useOsUiStore,
  type BannerDuration,
  type NotificationCategory,
} from "../osUiStore";
import {
  applySettingsBackup,
  downloadSettingsBackup,
  parseSettingsBackup,
} from "../settingsBackup";
import {
  ACCENT_CHROMA,
  ACCENT_COLORS,
  ACCENT_HUES,
  applyThemeSettings,
  readThemeSettings,
  resolveThemeMode,
  updateThemeSettings,
  WALLPAPERS,
} from "../theme";
import type { ThemeSettings } from "../types";
import {
  getDeviceRows,
  getStorageLabel,
  readHighEntropyDeviceInfo,
  type DeviceSnapshot,
  type StorageSnapshot,
} from "../systemInfo";
import type { AutoLockMinutes } from "../systemPrefs";
import { requestVrDesktopEnter } from "../vrDesktop/requestVrEnter";
import {
  formatVrCapabilityHint,
  refreshVrCapability,
  useVrDesktopStore,
} from "../vrDesktop/vrDesktopStore";
import { useDesktopStore } from "../windowStore";

type SettingsSection = "general" | "appearance" | "notifications" | "network" | "data" | "developer" | "about";

function phrase(t: (key: TranslationKey) => string, prefix: TranslationKey, value: string | number, suffix: TranslationKey) {
  return `${t(prefix)}${value}${t(suffix)}`;
}

function dash(value: string | number | null | undefined, empty = "—") {
  if (value == null || value === "" || value === "—") return empty;
  return String(value);
}

export function SettingsApp() {
  const [section, setSection] = useState<SettingsSection>("general");
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(readThemeSettings);
  const [storage, setStorage] = useState<StorageSnapshot | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceSnapshot | undefined>();
  const [network, setNetwork] = useState<NetworkSnapshot | null>(null);
  const [networkBusy, setNetworkBusy] = useState(false);

  const addNotification = useNotificationStore((state) => state.addNotification);
  const resetVirtualFiles = useFsStore((state) => state.resetVirtualFiles);
  const resetWindowLayout = useDesktopStore((state) => state.resetWindowLayout);
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const t = useLanguageStore((state) => state.t);
  const notificationPrefs = useOsUiStore((state) => state.notificationPrefs);
  const setNotificationPrefs = useOsUiStore((state) => state.setNotificationPrefs);
  const developerPrefs = useOsUiStore((state) => state.developerPrefs);
  const setDeveloperPrefs = useOsUiStore((state) => state.setDeveloperPrefs);
  const systemPrefs = useOsUiStore((state) => state.systemPrefs);
  const setSystemPrefs = useOsUiStore((state) => state.setSystemPrefs);
  const widgetsCollapsed = useOsUiStore((state) => state.widgetsCollapsed);
  const setWidgetsCollapsed = useOsUiStore((state) => state.setWidgetsCollapsed);
  const desktopLayoutMode = useDesktopStore((state) => state.desktopLayoutMode);
  const setDesktopLayoutMode = useDesktopStore((state) => state.setDesktopLayoutMode);
  const vrPrefs = useVrDesktopStore((state) => state.prefs);
  const setVrPrefs = useVrDesktopStore((state) => state.setPrefs);
  const vrCapability = useVrDesktopStore((state) => state.capability);
  const vrSessionSupported = useVrDesktopStore((state) => state.sessionSupported);
  const vrPhase = useVrDesktopStore((state) => state.phase);
  const vrLastError = useVrDesktopStore((state) => state.lastError);
  const importInputRef = useRef<HTMLInputElement>(null);
  const dndEnabled = notificationPrefs.dndEnabled;
  const dndStart = notificationPrefs.dndStart;
  const dndEnd = notificationPrefs.dndEnd;

  useEffect(() => {
    navigator.storage?.estimate().then(setStorage).catch(() => setStorage(null));
    void readHighEntropyDeviceInfo().then(setDeviceInfo);
  }, []);

  useEffect(() => {
    if (!vrPrefs.enabled) return;
    void refreshVrCapability();
  }, [vrPrefs.enabled]);

  useEffect(() => {
    // Keep document tokens in sync when local settings state changes (mode/density/wallpaper/accent).
    applyThemeSettings(themeSettings);
  }, [themeSettings]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function refresh() {
      setNetworkBusy(true);
      try {
        const snapshot = await collectNetworkSnapshot(controller.signal);
        if (!cancelled) setNetwork(snapshot);
      } finally {
        if (!cancelled) setNetworkBusy(false);
      }
    }

    void refresh();
    const unsubscribe = subscribeNetworkChange(() => {
      void refresh();
    });

    return () => {
      cancelled = true;
      controller.abort();
      unsubscribe();
    };
  }, []);

  async function clearCacheStorage() {
    if (!("caches" in window)) {
      addNotification({ title: t("cacheUnavailable"), message: t("cacheUnavailableMessage"), type: "warning", category: "system", appId: "settings" });
      return;
    }
    const ok = await appConfirm({
      title: t("dialogConfirmTitle"),
      message: t("confirmClearCache"),
      confirmLabel: t("dialogConfirm"),
      danger: true,
    });
    if (!ok) return;
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    navigator.storage?.estimate().then(setStorage).catch(() => setStorage(null));
    addNotification({ title: t("cacheCleared"), message: phrase(t, "cacheClearedPrefix", keys.length, "cacheClearedSuffix"), type: "success", category: "system", appId: "settings" });
  }

  async function resetLocalFiles() {
    const ok = await appConfirm({
      title: t("dialogConfirmTitle"),
      message: t("confirmResetFiles"),
      confirmLabel: t("dialogConfirm"),
      danger: true,
    });
    if (!ok) return;
    await resetVirtualFiles();
    navigator.storage?.estimate().then(setStorage).catch(() => setStorage(null));
    addNotification({ title: t("virtualStorageReset"), message: t("virtualStorageResetMessage"), type: "success", category: "system", appId: "settings" });
  }

  async function clearSiteData() {
    const ok = await appConfirm({
      title: t("dialogConfirmTitle"),
      message: t("confirmClearSiteData"),
      confirmLabel: t("dialogConfirm"),
      danger: true,
    });
    if (!ok) return;
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    localStorage.clear();
    resetWindowLayout();
    await resetVirtualFiles();
    addNotification({ title: t("siteDataCleared"), message: t("siteDataClearedMessage"), type: "success", category: "system", appId: "settings" });
    window.setTimeout(() => window.location.reload(), 700);
  }

  async function setWallpaper(target: "light" | "dark", wallpaperId: ThemeSettings["wallpaperId"]) {
    const wallpaper = WALLPAPERS[wallpaperId];
    if (wallpaper.url) {
      const url = wallpaper.url;
      const loaded = await new Promise<boolean>((resolve) => {
        const image = new Image();
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
        image.src = url;
      });
      if (!loaded) {
        addNotification({ title: t("wallpaperLoadFailed"), message: t("wallpaperLoadFailedMessage"), type: "warning", category: "system", appId: "settings" });
        return;
      }
    }
    const next = {
      ...themeSettings,
      wallpaperId,
      wallpaperLightId: target === "light" ? wallpaperId : themeSettings.wallpaperLightId,
      wallpaperDarkId: target === "dark" ? wallpaperId : themeSettings.wallpaperDarkId,
    } satisfies ThemeSettings;
    setThemeSettings(next);
    updateThemeSettings(next);
  }

  const effectiveTheme = resolveThemeMode(themeSettings.theme);
  const wallpaperEntries = Object.entries(WALLPAPERS) as [ThemeSettings["wallpaperId"], (typeof WALLPAPERS)[ThemeSettings["wallpaperId"]]][];
  const wallpaperGroups = wallpaperEntries.reduce<Record<string, typeof wallpaperEntries>>((groups, entry) => {
    const key = entry[1].categoryKey;
    groups[key] ??= [];
    groups[key].push(entry);
    return groups;
  }, {});
  const randomWallpaperIds = wallpaperEntries.map(([id]) => id);
  const aboutRows = useMemo(() => getDeviceRows(storage, deviceInfo, t), [deviceInfo, storage, t]);

  function syncWallpapers() {
    const sourceId = effectiveTheme === "dark" ? themeSettings.wallpaperDarkId : themeSettings.wallpaperLightId;
    const nextSettings = {
      ...themeSettings,
      wallpaperId: sourceId,
      wallpaperLightId: sourceId,
      wallpaperDarkId: sourceId,
    } satisfies ThemeSettings;
    setThemeSettings(nextSettings);
    updateThemeSettings(nextSettings);
  }

  function randomizeWallpaper(target: "light" | "dark") {
    const nextId = randomWallpaperIds[Math.floor(Math.random() * randomWallpaperIds.length)] ?? "system";
    void setWallpaper(target, nextId);
  }

  async function refreshNetwork() {
    setNetworkBusy(true);
    try {
      setNetwork(await collectNetworkSnapshot());
    } finally {
      setNetworkBusy(false);
    }
  }

  function exportSettings() {
    downloadSettingsBackup();
    addNotification({ title: t("settingsExportDone"), message: "", type: "success", category: "system", appId: "settings" });
  }

  async function importSettingsFile(file: File) {
    const ok = await appConfirm({
      title: t("dialogConfirmTitle"),
      message: t("confirmImportSettings"),
      confirmLabel: t("dialogConfirm"),
      danger: true,
    });
    if (!ok) return;
    try {
      const text = await file.text();
      const backup = parseSettingsBackup(text);
      applySettingsBackup(backup);
      addNotification({ title: t("settingsImportDone"), message: "", type: "success", category: "system", appId: "settings" });
      window.setTimeout(() => window.location.reload(), 400);
    } catch {
      addNotification({
        title: t("settingsImportFailed"),
        message: t("settingsImportFailedMessage"),
        type: "error",
        category: "system",
        appId: "settings",
      });
    }
  }

  const navItems: { id: SettingsSection; icon: string; label: TranslationKey; tint: string }[] = [
    { id: "general", icon: "solar:slider-minimalistic-horizontal-bold-duotone", label: "settingsNavGeneral", tint: "tint-sky" },
    { id: "appearance", icon: "solar:pallete-2-bold-duotone", label: "settingsNavAppearance", tint: "tint-violet" },
    { id: "notifications", icon: "solar:bell-bold-duotone", label: "settingsNavNotifications", tint: "tint-amber" },
    { id: "network", icon: "solar:wi-fi-router-bold-duotone", label: "settingsNavNetwork", tint: "tint-mint" },
    { id: "data", icon: "solar:database-bold-duotone", label: "settingsNavData", tint: "tint-indigo" },
    { id: "developer", icon: "solar:code-square-bold-duotone", label: "settingsNavDeveloper", tint: "tint-sky" },
    { id: "about", icon: "solar:info-circle-bold-duotone", label: "settingsNavAbout", tint: "tint-rose" },
  ];

  return (
    <div className="settings-app settings-shell">
      <aside className="settings-nav" aria-label={t("appSettings")}>
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={clsx("settings-nav-item", item.tint, section === item.id && "is-active")}
            onClick={() => setSection(item.id)}
          >
            <Icon icon={item.icon} width={16} height={16} />
            <span>{t(item.label)}</span>
          </button>
        ))}
      </aside>

      <div className="settings-main">
        {section === "general" ? (
          <div className="settings-stack">
            <header className="settings-pane-head">
              <h2>{t("settingsNavGeneral")}</h2>
            </header>

            <section className="settings-card">
              <header className="settings-card-head">
                <strong>{t("settingsLanguage")}</strong>
              </header>
              <div className="settings-choice-grid">
                {(["zh", "en"] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    className={clsx("settings-choice-card", language === lang && "is-active")}
                    onClick={() => setLanguage(lang)}
                  >
                    <strong>{lang === "zh" ? t("languageChinese") : t("languageEnglish")}</strong>
                  </button>
                ))}
              </div>
            </section>

            <section className="settings-card">
              <header className="settings-card-head">
                <strong>{t("settingsTimeFormat")}</strong>
              </header>
              <div className="settings-choice-grid">
                {([
                  { hour12: false, label: t("settingsTime24h") },
                  { hour12: true, label: t("settingsTime12h") },
                ]).map((item) => (
                  <button
                    key={String(item.hour12)}
                    type="button"
                    className={clsx("settings-choice-card", systemPrefs.hour12 === item.hour12 && "is-active")}
                    onClick={() => setSystemPrefs({ hour12: item.hour12 })}
                  >
                    <strong>{item.label}</strong>
                  </button>
                ))}
              </div>
            </section>

            <section className="settings-card">
              <header className="settings-card-head">
                <strong>{t("settingsAutoLock")}</strong>
              </header>
              <div className="settings-select-group">
                {([
                  { minutes: 0 as AutoLockMinutes, label: t("settingsAutoLockNever") },
                  { minutes: 5 as AutoLockMinutes, label: t("settingsAutoLock5") },
                  { minutes: 15 as AutoLockMinutes, label: t("settingsAutoLock15") },
                  { minutes: 30 as AutoLockMinutes, label: t("settingsAutoLock30") },
                ]).map((item) => (
                  <button
                    key={item.minutes}
                    type="button"
                    className={clsx("settings-btn-pill", systemPrefs.autoLockMinutes === item.minutes && "is-active")}
                    onClick={() => setSystemPrefs({ autoLockMinutes: item.minutes })}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="settings-card">
              <div className="settings-row-line">
                <strong>{t("settingsTaskbarLabels")}</strong>
                <button
                  type="button"
                  className={clsx("settings-switch", systemPrefs.taskbarShowLabels && "is-on")}
                  aria-pressed={systemPrefs.taskbarShowLabels}
                  onClick={() => setSystemPrefs({ taskbarShowLabels: !systemPrefs.taskbarShowLabels })}
                >
                  <i />
                </button>
              </div>
              <div className="settings-row-line">
                <strong>{t("settingsTaskbarAutoHide")}</strong>
                <button
                  type="button"
                  className={clsx("settings-switch", systemPrefs.taskbarAutoHide && "is-on")}
                  aria-pressed={systemPrefs.taskbarAutoHide}
                  onClick={() => setSystemPrefs({ taskbarAutoHide: !systemPrefs.taskbarAutoHide })}
                >
                  <i />
                </button>
              </div>
              <div className="settings-row-line">
                <strong>{t("settingsDesktopWidgets")}</strong>
                <button
                  type="button"
                  className={clsx("settings-switch", !widgetsCollapsed && "is-on")}
                  aria-pressed={!widgetsCollapsed}
                  onClick={() => setWidgetsCollapsed(!widgetsCollapsed)}
                >
                  <i />
                </button>
              </div>
            </section>

            <section className="settings-card">
              <header className="settings-card-head">
                <strong>{t("settingsDesktopLayout")}</strong>
              </header>
              <div className="settings-choice-grid">
                {([
                  { mode: "grid" as const, label: t("settingsDesktopLayoutGrid") },
                  { mode: "free" as const, label: t("settingsDesktopLayoutFree") },
                ]).map((item) => (
                  <button
                    key={item.mode}
                    type="button"
                    className={clsx("settings-choice-card", desktopLayoutMode === item.mode && "is-active")}
                    onClick={() => setDesktopLayoutMode(item.mode)}
                  >
                    <strong>{item.label}</strong>
                  </button>
                ))}
              </div>
            </section>

            <section className="settings-card">
              <header className="settings-card-head">
                <strong>{t("settingsAccessibility")}</strong>
              </header>
              <div className="settings-row-line">
                <strong>{t("settingsReduceMotion")}</strong>
                <button
                  type="button"
                  className={clsx("settings-switch", developerPrefs.reduceMotion && "is-on")}
                  aria-pressed={developerPrefs.reduceMotion}
                  onClick={() => setDeveloperPrefs({ reduceMotion: !developerPrefs.reduceMotion })}
                >
                  <i />
                </button>
              </div>
              <div className="settings-row-line">
                <strong>{t("settingsLargeTargets")}</strong>
                <button
                  type="button"
                  className={clsx("settings-switch", developerPrefs.largeTargets && "is-on")}
                  aria-pressed={developerPrefs.largeTargets}
                  onClick={() => setDeveloperPrefs({ largeTargets: !developerPrefs.largeTargets })}
                >
                  <i />
                </button>
              </div>
              <div className="settings-row-line">
                <strong>{t("settingsHighContrast")}</strong>
                <button
                  type="button"
                  className={clsx("settings-switch", developerPrefs.highContrast && "is-on")}
                  aria-pressed={developerPrefs.highContrast}
                  onClick={() => setDeveloperPrefs({ highContrast: !developerPrefs.highContrast })}
                >
                  <i />
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {section === "appearance" ? (
          <div className="settings-stack">
            <header className="settings-pane-head">
              <h2>{t("settingsNavAppearance")}</h2>
            </header>

            <section className="settings-card">
              <header className="settings-card-head">
                <strong>{t("settingsTheme")}</strong>
              </header>
              <div className="settings-choice-grid cols-3">
                {([
                  { mode: "system" as const, label: t("colorSystem") },
                  { mode: "light" as const, label: t("colorLight") },
                  { mode: "dark" as const, label: t("colorDark") },
                ]).map((item) => (
                  <button
                    key={item.mode}
                    type="button"
                    className={clsx("settings-choice-card", themeSettings.theme === item.mode && "is-active")}
                    onClick={() => {
                      const next = updateThemeSettings({ theme: item.mode });
                      setThemeSettings(next);
                    }}
                  >
                    <strong>{item.label}</strong>
                  </button>
                ))}
              </div>
            </section>

            <section className="settings-card">
              <header className="settings-card-head">
                <strong>{t("settingsAccent")}</strong>
              </header>
              <div className="settings-accent-row">
                {ACCENT_COLORS.map((color) => {
                  const labelKey = `accent${color[0].toUpperCase()}${color.slice(1)}` as TranslationKey;
                  return (
                    <button
                      key={color}
                      type="button"
                      className={clsx("settings-accent-swatch", themeSettings.accentColor === color && "is-active")}
                      style={{ background: `oklch(0.62 ${ACCENT_CHROMA[color]} ${ACCENT_HUES[color]})` }}
                      title={t(labelKey)}
                      aria-label={t(labelKey)}
                      onClick={() => setThemeSettings(updateThemeSettings({ accentColor: color }))}
                    />
                  );
                })}
              </div>
            </section>

            <section className="settings-card">
              <header className="settings-card-head">
                <strong>{t("settingsDensity")}</strong>
              </header>
              <div className="settings-choice-grid">
                {([
                  { d: "cozy" as const, label: t("densityCozy") },
                  { d: "compact" as const, label: t("densityCompact") },
                ]).map((item) => (
                  <button
                    key={item.d}
                    type="button"
                    className={clsx("settings-choice-card", themeSettings.density === item.d && "is-active")}
                    onClick={() => setThemeSettings(updateThemeSettings({ density: item.d }))}
                  >
                    <strong>{item.label}</strong>
                  </button>
                ))}
              </div>
            </section>

            <section className="settings-card">
              <header className="settings-card-head">
                <strong>{t("settingsWallpaper")}</strong>
                <div className="settings-card-actions">
                  <button type="button" className="settings-btn-pill" onClick={syncWallpapers}>{t("settingsWallpaperSync")}</button>
                  <button type="button" className="settings-btn-pill" onClick={() => randomizeWallpaper("light")}>{t("settingsWallpaperRandom")}</button>
                </div>
              </header>
              {(["light", "dark"] as const).map((target) => (
                <div key={target} className="settings-subsection wallpaper-mode-section">
                  <h4>{t(target === "light" ? "settingsWallpaperLight" : "settingsWallpaperDark")}</h4>
                  {Object.entries(wallpaperGroups).map(([categoryKey, entries]) => (
                    <section key={`${target}-${categoryKey}`} className="wallpaper-group">
                      <h4>{t(categoryKey as TranslationKey)}</h4>
                      <div className="wallpaper-grid">
                        {entries.map(([id, wallpaper]) => {
                          const activeWallpaperId = target === "light" ? themeSettings.wallpaperLightId : themeSettings.wallpaperDarkId;
                          return (
                            <button
                              key={`${target}-${id}`}
                              type="button"
                              className={clsx("wallpaper-option", activeWallpaperId === id && "is-active")}
                              onClick={() => void setWallpaper(target, id)}
                              style={wallpaper.url ? { backgroundImage: `linear-gradient(180deg, oklch(0 0 0 / 0.08), oklch(0 0 0 / 0.44)), url("${wallpaper.url}")` } : undefined}
                            >
                              <span>{t(wallpaper.labelKey)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              ))}
              <div className="settings-split-row">
                <div>
                  <h4>{t("wallpaperFit")}</h4>
                  <div className="settings-select-group">
                    {(["cover", "contain", "stretch", "tile"] as const).map((fit) => (
                      <button
                        key={fit}
                        type="button"
                        className={clsx("settings-btn-pill", themeSettings.wallpaperFit === fit && "is-active")}
                        onClick={() => setThemeSettings(updateThemeSettings({ wallpaperFit: fit }))}
                      >
                        {t(fit === "cover" ? "wallpaperFitCover" : fit === "contain" ? "wallpaperFitContain" : fit === "stretch" ? "wallpaperFitStretch" : "wallpaperFitTile")}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h4>{t("settingsWallpaperOverlay")}</h4>
                  <div className="settings-select-group">
                    {(["off", "soft", "standard"] as const).map((overlay) => (
                      <button
                        key={overlay}
                        type="button"
                        className={clsx("settings-btn-pill", themeSettings.wallpaperOverlay === overlay && "is-active")}
                        onClick={() => setThemeSettings(updateThemeSettings({ wallpaperOverlay: overlay }))}
                      >
                        {t(overlay === "off" ? "wallpaperOverlayOff" : overlay === "soft" ? "wallpaperOverlaySoft" : "wallpaperOverlayStandard")}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {section === "notifications" ? (
          <div className="settings-stack">
            <header className="settings-pane-head">
              <h2>{t("settingsNavNotifications")}</h2>
            </header>

            <section className="settings-card">
              <div className="settings-row-line">
                <strong>{t("notificationDndToggle")}</strong>
                <button
                  type="button"
                  className={clsx("settings-switch", dndEnabled && "is-on")}
                  aria-pressed={dndEnabled}
                  onClick={() => setNotificationPrefs({ dndEnabled: !dndEnabled })}
                >
                  <i />
                </button>
              </div>
            </section>

            <section className="settings-card">
              <header className="settings-card-head">
                <strong>{t("settingsDndSchedule")}</strong>
              </header>
              <div className="settings-inline-fields">
                <label>
                  <span>{t("settingsDndStart")}</span>
                  <input
                    type="time"
                    value={dndStart}
                    onChange={(event) => setNotificationPrefs({ dndStart: event.target.value })}
                  />
                </label>
                <label>
                  <span>{t("settingsDndEnd")}</span>
                  <input
                    type="time"
                    value={dndEnd}
                    onChange={(event) => setNotificationPrefs({ dndEnd: event.target.value })}
                  />
                </label>
              </div>
            </section>

            <section className="settings-card">
              <header className="settings-card-head">
                <strong>{t("settingsBannerDuration")}</strong>
              </header>
              <div className="settings-select-group">
                {([
                  { id: "short" as BannerDuration, label: t("settingsBannerShort") },
                  { id: "standard" as BannerDuration, label: t("settingsBannerStandard") },
                  { id: "long" as BannerDuration, label: t("settingsBannerLong") },
                ]).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={clsx("settings-btn-pill", notificationPrefs.bannerDuration === item.id && "is-active")}
                    onClick={() => setNotificationPrefs({ bannerDuration: item.id })}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="settings-card">
              <header className="settings-card-head">
                <strong>{t("settingsNotifyCategories")}</strong>
              </header>
              {([
                { id: "system" as NotificationCategory, label: t("notificationCategorySystem") },
                { id: "files" as NotificationCategory, label: t("notificationCategoryFiles") },
                { id: "apps" as NotificationCategory, label: t("notificationCategoryApps") },
                { id: "media" as NotificationCategory, label: t("notificationCategoryMedia") },
              ]).map((item) => (
                <div key={item.id} className="settings-row-line">
                  <strong>{item.label}</strong>
                  <button
                    type="button"
                    className={clsx("settings-switch", notificationPrefs.categories[item.id] && "is-on")}
                    aria-pressed={notificationPrefs.categories[item.id]}
                    onClick={() =>
                      setNotificationPrefs((current) => ({
                        ...current,
                        categories: {
                          ...current.categories,
                          [item.id]: !current.categories[item.id],
                        },
                      }))
                    }
                  >
                    <i />
                  </button>
                </div>
              ))}
            </section>
          </div>
        ) : null}

        {section === "network" ? (
          <div className="settings-stack">
            <header className="settings-pane-head">
              <h2>{t("settingsNavNetwork")}</h2>
              <button type="button" className="settings-btn-pill" disabled={networkBusy} onClick={() => void refreshNetwork()}>
                {networkBusy ? t("settingsNetworkRefreshing") : t("settingsNetworkRefresh")}
              </button>
            </header>

            <dl className="settings-kv settings-kv-plain">
              {([
                [t("settingsNetworkType"), network?.online ? t("settingsNetworkOnline") : t("settingsNetworkOffline")],
                [t("settingsNetworkPublicIp"), dash(network?.publicIp)],
                [t("settingsNetworkMeasuredRtt"), network?.measuredRttMs != null ? `${network.measuredRttMs} ms` : "—"],
                [t("settingsNetworkLanIp"), network?.lanIps?.length ? network.lanIps.join(", ") : "—"],
                [t("settingsNetworkLocalIp"), network?.localIps?.length ? network.localIps.join(", ") : network?.mdnsHosts?.length ? network.mdnsHosts.join(", ") : "—"],
                [t("settingsNetworkEffective"), formatEffectiveType(network?.effectiveType ?? "unknown")],
                [t("settingsNetworkDownlink"), network?.downlinkMbps != null ? `${network.downlinkMbps} Mbps` : "—"],
                [t("settingsNetworkRtt"), network?.rttMs != null ? `${network.rttMs} ms` : "—"],
                [t("settingsNetworkSaveData"), network?.saveData ? t("yes") : t("no")],
                [t("settingsNetworkPageHost"), dash(network?.pageHost)],
              ] as const).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd title={value}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {section === "data" ? (
          <div className="settings-stack">
            <header className="settings-pane-head">
              <h2>{t("settingsNavData")}</h2>
            </header>

            <dl className="settings-kv settings-kv-plain">
              <div>
                <dt>{t("dataOriginStorage")}</dt>
                <dd>{getStorageLabel(storage)}</dd>
              </div>
            </dl>

            <section className="settings-card">
              <div className="settings-row-line">
                <strong>{t("settingsExport")}</strong>
                <button type="button" className="settings-btn-pill" onClick={exportSettings}>{t("settingsExport")}</button>
              </div>
              <div className="settings-row-line">
                <strong>{t("settingsImport")}</strong>
                <button type="button" className="settings-btn-pill" onClick={() => importInputRef.current?.click()}>{t("settingsImport")}</button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void importSettingsFile(file);
                  }}
                />
              </div>
              <div className="settings-row-line">
                <strong>{t("clearCache")}</strong>
                <button type="button" className="settings-btn-pill" onClick={() => void clearCacheStorage()}>{t("clearCache")}</button>
              </div>
              <div className="settings-row-line">
                <strong>{t("virtualFiles")}</strong>
                <button type="button" className="settings-btn-pill" onClick={() => void resetLocalFiles()}>{t("resetFiles")}</button>
              </div>
              <div className="settings-row-line">
                <strong>{t("siteData")}</strong>
                <button type="button" className="settings-btn-pill" onClick={() => void clearSiteData()}>{t("clearSiteData")}</button>
              </div>
            </section>
          </div>
        ) : null}

        {section === "developer" ? (
          <div className="settings-stack">
            <header className="settings-pane-head">
              <h2>{t("settingsNavDeveloper")}</h2>
            </header>

            <section className="settings-card">
              <header className="settings-card-head">
                <strong>{t("settingsAnimationQuality")}</strong>
              </header>
              <div className="settings-choice-grid">
                {([
                  { id: "fluid" as const, label: t("settingsAnimationFluid") },
                  { id: "power" as const, label: t("settingsAnimationPower") },
                ]).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={clsx("settings-choice-card", developerPrefs.animationQuality === item.id && "is-active")}
                    onClick={() => setDeveloperPrefs({ animationQuality: item.id })}
                  >
                    <strong>{item.label}</strong>
                  </button>
                ))}
              </div>
            </section>

            <section className="settings-card">
              <div className="settings-row-line">
                <strong>{t("settingsShowFps")}</strong>
                <button
                  type="button"
                  className={clsx("settings-switch", developerPrefs.showFps && "is-on")}
                  aria-pressed={developerPrefs.showFps}
                  onClick={() => setDeveloperPrefs({ showFps: !developerPrefs.showFps })}
                >
                  <i />
                </button>
              </div>
              <div className="settings-row-line">
                <strong>{t("settingsDebugBorders")}</strong>
                <button
                  type="button"
                  className={clsx("settings-switch", developerPrefs.debugBorders && "is-on")}
                  aria-pressed={developerPrefs.debugBorders}
                  onClick={() => setDeveloperPrefs({ debugBorders: !developerPrefs.debugBorders })}
                >
                  <i />
                </button>
              </div>
            </section>

            <section className="settings-card">
              <header className="settings-card-head">
                <strong>{t("settingsVrDesktop")}</strong>
                <span className="settings-badge-muted">{t("settingsVrDesktopExperimental")}</span>
              </header>
              <div className="settings-row-line">
                <strong>{t("settingsVrDesktopEnable")}</strong>
                <button
                  type="button"
                  className={clsx("settings-switch", vrPrefs.enabled && "is-on")}
                  aria-pressed={vrPrefs.enabled}
                  onClick={() => {
                    setVrPrefs({ enabled: !vrPrefs.enabled });
                  }}
                >
                  <i />
                </button>
              </div>
              {vrPrefs.enabled ? (
                <>
                  <div className="settings-row-line">
                    <strong>
                      {vrPhase === "entering"
                        ? t("settingsVrDesktopEntering")
                        : vrPhase === "error"
                          ? t("settingsVrDesktopFailed")
                          : vrCapability === "unavailable"
                            ? t("settingsVrDesktopNeedHttps")
                            : t("settingsVrDesktopEnter")}
                    </strong>
                    <button
                      type="button"
                      className="settings-btn-pill"
                      disabled={vrPhase === "entering" || vrPhase === "active"}
                      onClick={() => {
                        // Sync call path — no await before requestSession (Quest).
                        void requestVrDesktopEnter({ t, addNotification });
                      }}
                    >
                      {t("settingsVrDesktopEnter")}
                    </button>
                  </div>
                  <div className="settings-row-line">
                    <strong>{t("settingsVrDesktopQuality")}</strong>
                  </div>
                  <div className="settings-choice-grid cols-3">
                    {([
                      { id: "high" as const, label: t("settingsVrDesktopQualityHigh") },
                      { id: "balanced" as const, label: t("settingsVrDesktopQualityBalanced") },
                      { id: "low" as const, label: t("settingsVrDesktopQualityLow") },
                    ]).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={clsx(
                          "settings-choice-card",
                          vrPrefs.renderQuality === item.id && "is-active",
                        )}
                        onClick={() => setVrPrefs({ renderQuality: item.id })}
                      >
                        <strong>{item.label}</strong>
                      </button>
                    ))}
                  </div>
                  <div className="settings-row-line">
                    <strong>{t("settingsVrDesktopSoftEdges")}</strong>
                    <button
                      type="button"
                      className={clsx("settings-switch", vrPrefs.softEdges && "is-on")}
                      aria-pressed={vrPrefs.softEdges}
                      disabled={vrPrefs.renderQuality === "low"}
                      onClick={() => setVrPrefs({ softEdges: !vrPrefs.softEdges })}
                    >
                      <i />
                    </button>
                  </div>
                  <div className="settings-row-line">
                    <strong>{t("settingsVrDesktopShowFps")}</strong>
                    <button
                      type="button"
                      className={clsx("settings-switch", vrPrefs.showFps && "is-on")}
                      aria-pressed={vrPrefs.showFps}
                      onClick={() => setVrPrefs({ showFps: !vrPrefs.showFps })}
                    >
                      <i />
                    </button>
                  </div>
                  <div className="settings-row-line">
                    <strong>{t("settingsVrDesktopResetLayout")}</strong>
                    <button
                      type="button"
                      className="settings-btn-pill"
                      onClick={() => useVrDesktopStore.getState().resetLayout()}
                    >
                      {t("settingsVrDesktopResetLayout")}
                    </button>
                  </div>
                  <p className="settings-inline-hint" style={{ wordBreak: "break-all" }}>
                    {formatVrCapabilityHint(vrCapability, vrSessionSupported)}
                    {vrLastError ? ` · ${vrLastError}` : ""}
                  </p>
                </>
              ) : null}
            </section>
          </div>
        ) : null}

        {section === "about" ? (
          <div className="settings-stack">
            <header className="settings-pane-head">
              <h2>{t("settingsNavAbout")}</h2>
            </header>

            <dl className="settings-kv settings-kv-plain">
              {([
                [t("edition"), "NekoVirtOS Web"],
                [t("version"), APP_VERSION],
                ...aboutRows,
              ] as const).map(([label, value]) => (
                <div key={String(label)}>
                  <dt>{label}</dt>
                  <dd title={String(value)}>{String(value)}</dd>
                </div>
              ))}
            </dl>

            <section className="settings-block">
              <h3 className="settings-section-title">{t("aboutOpenSource")}</h3>
              <div className="about-licenses-table" role="table" aria-label={t("aboutOpenSource")}>
                <div className="about-licenses-row is-head" role="row">
                  <span role="columnheader">{t("aboutPackage")}</span>
                  <span role="columnheader">{t("aboutPackageVersion")}</span>
                  <span role="columnheader">{t("aboutPackageLicense")}</span>
                </div>
                {OPEN_SOURCE_PACKAGES.map((pkg) => (
                  <div key={pkg.name} className="about-licenses-row" role="row">
                    <span className="about-pkg-name" role="cell" title={pkg.name}>{pkg.name}</span>
                    <span className="about-pkg-ver mmd-mono" role="cell">{pkg.version}</span>
                    <span className="about-pkg-lic" role="cell" title={pkg.license}>{pkg.license}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
