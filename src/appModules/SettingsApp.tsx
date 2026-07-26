import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { appConfirm } from "../dialogStore";
import { useFsStore } from "../fs";
import { useLanguageStore, type TranslationKey } from "../languageStore";
import { phrase } from "../shell/phrase";
import {
  collectNetworkSnapshot,
  formatConnectionType,
  formatEffectiveType,
  subscribeNetworkChange,
  type NetworkSnapshot,
} from "../system/networkInfo";
import { useNotificationStore } from "../notificationStore";
import { APP_VERSION, OPEN_SOURCE_PACKAGES } from "../system/openSourceLicenses";
import {
  useOsUiStore,
  type BannerDuration,
  type NotificationCategory,
} from "../osUiStore";
import {
  applySettingsBackup,
  downloadSettingsBackup,
  parseSettingsBackup,
} from "../system/settingsBackup";
import { resetSiteData } from "../system/siteDataReset";
import {
  ACCENT_CHROMA,
  ACCENT_COLORS,
  ACCENT_HUES,
  applyThemeSettings,
  readThemeSettings,
  resolveThemeMode,
  updateThemeSettings,
  WALLPAPERS,
} from "../system/theme";
import type { ThemeSettings } from "../types";
import {
  getDeviceRows,
  getStorageLabel,
  readHighEntropyDeviceInfo,
  type DeviceSnapshot,
  type StorageSnapshot,
} from "../system/systemInfo";
import type { AutoLockMinutes } from "../system/systemPrefs";
import { useDesktopStore } from "../windowStore";
import { SettingsChoiceGroup, SettingsSwitch } from "./settings/components/SettingsControls";
import { consumeSettingsSection, subscribeSettingsSection, type SettingsSection } from "./settings/settingsNavigation";

function dash(value: string | number | null | undefined, empty = "—") {
  if (value == null || value === "" || value === "—") return empty;
  return String(value);
}

function SettingsCardTitle({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="settings-card-title">
      <Icon icon={icon} width={16} height={16} />
      <strong>{children}</strong>
    </span>
  );
}

function SettingsRowLabel({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="settings-row-label">
      <Icon icon={icon} width={15} height={15} />
      <strong>{children}</strong>
    </span>
  );
}

export function SettingsApp() {
  const [section, setSection] = useState<SettingsSection>(() => consumeSettingsSection("general"));
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(readThemeSettings);
  const [storage, setStorage] = useState<StorageSnapshot | null | undefined>(undefined);
  const [deviceInfo, setDeviceInfo] = useState<DeviceSnapshot | undefined>();
  const [network, setNetwork] = useState<NetworkSnapshot | null>(null);
  const [networkBusy, setNetworkBusy] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [siteDataBusy, setSiteDataBusy] = useState(false);
  const [settingsTransferBusy, setSettingsTransferBusy] = useState(false);

  const addNotification = useNotificationStore((state) => state.addNotification);
  const resetVirtualFiles = useFsStore((state) => state.resetVirtualFiles);
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
  const openApp = useDesktopStore((state) => state.openApp);
  const importInputRef = useRef<HTMLInputElement>(null);
  const networkControllerRef = useRef<AbortController | null>(null);
  const networkGenerationRef = useRef(0);
  const dndEnabled = notificationPrefs.dndEnabled;
  const dndStart = notificationPrefs.dndStart;
  const dndEnd = notificationPrefs.dndEnd;

  useEffect(() => subscribeSettingsSection(setSection), []);

  useEffect(() => {
    if (section !== "data" || storage !== undefined) return;
    let cancelled = false;
    navigator.storage?.estimate()
      .then((snapshot) => {
        if (!cancelled) setStorage(snapshot);
      })
      .catch(() => {
        if (!cancelled) setStorage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [section, storage]);

  useEffect(() => {
    if (section !== "about" || deviceInfo !== undefined) return;
    let cancelled = false;
    void readHighEntropyDeviceInfo().then((snapshot) => {
      if (!cancelled) setDeviceInfo(snapshot ?? {});
    });
    return () => {
      cancelled = true;
    };
  }, [deviceInfo, section]);

  useEffect(() => {
    // Keep document tokens in sync when local settings state changes (mode/density/wallpaper/accent).
    applyThemeSettings(themeSettings);
  }, [themeSettings]);

  useEffect(() => {
    if (section !== "network") return;
    const unsubscribe = subscribeNetworkChange(() => {
      networkControllerRef.current?.abort();
      networkGenerationRef.current += 1;
      setNetwork(null);
      setNetworkBusy(false);
      setNetworkError(false);
    });
    return () => {
      unsubscribe();
      networkControllerRef.current?.abort();
      networkControllerRef.current = null;
      networkGenerationRef.current += 1;
      setNetworkBusy(false);
    };
  }, [section]);

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
    if (siteDataBusy) return;
    const ok = await appConfirm({
      title: t("dialogConfirmTitle"),
      message: t("confirmClearSiteData"),
      confirmLabel: t("dialogConfirm"),
      danger: true,
    });
    if (!ok) return;
    setSiteDataBusy(true);
    try {
      const result = await resetSiteData();
      if (!result.ok) {
        const failedCount = result.stages.filter((stage) => !stage.ok).length;
        addNotification({
          title: t("siteDataResetFailed"),
          message: `${t("siteDataResetFailedMessage")} (${failedCount})`,
          type: "error",
          category: "system",
          appId: "settings",
        });
        window.setTimeout(() => window.location.reload(), 700);
        return;
      }
      addNotification({ title: t("siteDataCleared"), message: t("siteDataClearedMessage"), type: "success", category: "system", appId: "settings" });
      window.setTimeout(() => window.location.reload(), 700);
    } catch {
      addNotification({
        title: t("siteDataResetFailed"),
        message: t("siteDataResetFailedMessage"),
        type: "error",
        category: "system",
        appId: "settings",
      });
      window.setTimeout(() => window.location.reload(), 700);
    } finally {
      setSiteDataBusy(false);
    }
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
  const aboutRows = useMemo(() => getDeviceRows(storage ?? null, deviceInfo, t), [deviceInfo, storage, t]);

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
    networkControllerRef.current?.abort();
    const controller = new AbortController();
    networkControllerRef.current = controller;
    const generation = ++networkGenerationRef.current;
    setNetworkBusy(true);
    setNetworkError(false);
    try {
      const snapshot = await collectNetworkSnapshot(controller.signal);
      if (generation === networkGenerationRef.current) setNetwork(snapshot);
    } catch (error) {
      if (generation === networkGenerationRef.current && !(error instanceof DOMException && error.name === "AbortError")) {
        setNetworkError(true);
      }
    } finally {
      if (generation === networkGenerationRef.current) {
        setNetworkBusy(false);
        if (networkControllerRef.current === controller) networkControllerRef.current = null;
      }
    }
  }

  function exportSettings() {
    if (settingsTransferBusy) return;
    setSettingsTransferBusy(true);
    try {
      downloadSettingsBackup();
      addNotification({ title: t("settingsExportDone"), message: t("settingsBackupScope"), type: "success", category: "system", appId: "settings" });
    } catch {
      addNotification({ title: t("settingsExportFailed"), message: t("settingsExportFailedMessage"), type: "error", category: "system", appId: "settings" });
    } finally {
      setSettingsTransferBusy(false);
    }
  }

  async function importSettingsFile(file: File) {
    if (settingsTransferBusy) return;
    const ok = await appConfirm({
      title: t("dialogConfirmTitle"),
      message: t("confirmImportSettings"),
      confirmLabel: t("dialogConfirm"),
      danger: true,
    });
    if (!ok) return;
    setSettingsTransferBusy(true);
    try {
      const text = await file.text();
      const backup = parseSettingsBackup(text);
      applySettingsBackup(backup);
      addNotification({ title: t("settingsImportDone"), message: t("settingsImportDoneMessage"), type: "success", category: "system", appId: "settings" });
      window.setTimeout(() => window.location.reload(), 400);
    } catch {
      addNotification({
        title: t("settingsImportFailed"),
        message: t("settingsImportFailedMessage"),
        type: "error",
        category: "system",
        appId: "settings",
      });
    } finally {
      setSettingsTransferBusy(false);
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
            aria-current={section === item.id ? "page" : undefined}
            aria-label={t(item.label)}
            onClick={() => setSection(item.id)}
          >
            <Icon icon={item.icon} width={16} height={16} />
            <span>{t(item.label)}</span>
          </button>
        ))}
      </aside>

      <div className="settings-main" id={`settings-panel-${section}`} aria-labelledby={`settings-heading-${section}`}>
        {section === "general" ? (
          <div className="settings-stack">
            <header className="settings-pane-head">
              <h2 id="settings-heading-general">{t("settingsNavGeneral")}</h2>
            </header>

            <section className="settings-card">
              <header className="settings-card-head">
                <SettingsCardTitle icon="solar:global-bold-duotone">{t("settingsLanguage")}</SettingsCardTitle>
              </header>
              <SettingsChoiceGroup
                label={t("settingsLanguage")}
                value={language}
                onChange={setLanguage}
                options={(["zh", "en"] as const).map((lang) => ({
                  value: lang,
                  label: lang === "zh" ? t("languageChinese") : t("languageEnglish"),
                  content: <><span className="settings-choice-icon"><Icon icon={lang === "zh" ? "solar:global-bold-duotone" : "solar:text-bold-duotone"} width={16} height={16} /></span><strong>{lang === "zh" ? t("languageChinese") : t("languageEnglish")}</strong></>,
                }))}
              />
            </section>

            <section className="settings-card">
              <header className="settings-card-head">
                <SettingsCardTitle icon="solar:clock-circle-bold-duotone">{t("settingsTimeFormat")}</SettingsCardTitle>
              </header>
              <SettingsChoiceGroup
                label={t("settingsTimeFormat")}
                value={systemPrefs.hour12 ? "12" : "24"}
                onChange={(value) => setSystemPrefs({ hour12: value === "12" })}
                options={([
                  { hour12: false, label: t("settingsTime24h"), icon: "solar:clock-circle-bold-duotone" },
                  { hour12: true, label: t("settingsTime12h"), icon: "solar:history-bold-duotone" },
                ]).map((item) => ({ value: item.hour12 ? "12" as const : "24" as const, label: item.label, content: <><span className="settings-choice-icon"><Icon icon={item.icon} width={16} height={16} /></span><strong>{item.label}</strong></> }))}
              />
            </section>

            <section className="settings-card">
              <header className="settings-card-head">
                <SettingsCardTitle icon="solar:lock-keyhole-bold-duotone">{t("settingsAutoLock")}</SettingsCardTitle>
              </header>
              <SettingsChoiceGroup
                label={t("settingsAutoLock")}
                value={String(systemPrefs.autoLockMinutes)}
                className="settings-select-group"
                optionClassName="settings-btn-pill"
                onChange={(value) => setSystemPrefs({ autoLockMinutes: Number(value) as AutoLockMinutes })}
                options={([
                  { minutes: 0 as AutoLockMinutes, label: t("settingsAutoLockNever") },
                  { minutes: 5 as AutoLockMinutes, label: t("settingsAutoLock5") },
                  { minutes: 15 as AutoLockMinutes, label: t("settingsAutoLock15") },
                  { minutes: 30 as AutoLockMinutes, label: t("settingsAutoLock30") },
                ]).map((item) => ({ value: String(item.minutes), label: item.label }))}
              />
            </section>

            <section className="settings-card">
              <div className="settings-row-line">
                <SettingsRowLabel icon="solar:text-bold-duotone">{t("settingsTaskbarLabels")}</SettingsRowLabel>
                <SettingsSwitch checked={systemPrefs.taskbarShowLabels} label={t("settingsTaskbarLabels")} onChange={(checked) => setSystemPrefs({ taskbarShowLabels: checked })} />
              </div>
              <div className="settings-row-line">
                <SettingsRowLabel icon="solar:eye-bold-duotone">{t("settingsTaskbarAutoHide")}</SettingsRowLabel>
                <SettingsSwitch checked={systemPrefs.taskbarAutoHide} label={t("settingsTaskbarAutoHide")} onChange={(checked) => setSystemPrefs({ taskbarAutoHide: checked })} />
              </div>
              <div className="settings-row-line">
                <SettingsRowLabel icon="solar:widget-2-bold-duotone">{t("settingsDesktopWidgets")}</SettingsRowLabel>
                <SettingsSwitch checked={!widgetsCollapsed} label={t("settingsDesktopWidgets")} onChange={(checked) => setWidgetsCollapsed(!checked)} />
              </div>
            </section>

            <section className="settings-card">
              <header className="settings-card-head">
                <SettingsCardTitle icon="solar:widget-4-bold-duotone">{t("settingsDesktopLayout")}</SettingsCardTitle>
              </header>
              <SettingsChoiceGroup
                label={t("settingsDesktopLayout")}
                value={desktopLayoutMode}
                onChange={setDesktopLayoutMode}
                options={([
                  { mode: "grid" as const, label: t("settingsDesktopLayoutGrid"), icon: "solar:widget-4-bold-duotone" },
                  { mode: "free" as const, label: t("settingsDesktopLayoutFree"), icon: "solar:cursor-bold-duotone" },
                ]).map((item) => ({ value: item.mode, label: item.label, content: <><span className="settings-choice-icon"><Icon icon={item.icon} width={16} height={16} /></span><strong>{item.label}</strong></> }))}
              />
            </section>

            <section className="settings-card">
              <header className="settings-card-head">
                <SettingsCardTitle icon="solar:hand-stars-bold-duotone">{t("settingsAccessibility")}</SettingsCardTitle>
              </header>
              <div className="settings-row-line">
                <SettingsRowLabel icon="solar:play-circle-bold-duotone">{t("settingsReduceMotion")}</SettingsRowLabel>
                <SettingsSwitch checked={developerPrefs.reduceMotion} label={t("settingsReduceMotion")} onChange={(checked) => setDeveloperPrefs({ reduceMotion: checked })} />
              </div>
              <div className="settings-row-line">
                <SettingsRowLabel icon="solar:cursor-bold-duotone">{t("settingsLargeTargets")}</SettingsRowLabel>
                <SettingsSwitch checked={developerPrefs.largeTargets} label={t("settingsLargeTargets")} onChange={(checked) => setDeveloperPrefs({ largeTargets: checked })} />
              </div>
              <div className="settings-row-line">
                <SettingsRowLabel icon="solar:moon-bold-duotone">{t("settingsHighContrast")}</SettingsRowLabel>
                <SettingsSwitch checked={developerPrefs.highContrast} label={t("settingsHighContrast")} onChange={(checked) => setDeveloperPrefs({ highContrast: checked })} />
              </div>
            </section>
          </div>
        ) : null}

        {section === "appearance" ? (
          <div className="settings-stack">
            <header className="settings-pane-head">
              <h2 id="settings-heading-appearance">{t("settingsNavAppearance")}</h2>
            </header>

            <section className="settings-card">
              <header className="settings-card-head">
                <SettingsCardTitle icon="solar:pallete-2-bold-duotone">{t("settingsTheme")}</SettingsCardTitle>
              </header>
              <SettingsChoiceGroup
                label={t("settingsTheme")}
                value={themeSettings.theme}
                className="settings-choice-grid cols-3"
                onChange={(theme) => setThemeSettings(updateThemeSettings({ theme }))}
                options={([
                  { mode: "system" as const, label: t("colorSystem"), icon: "solar:laptop-bold-duotone" },
                  { mode: "light" as const, label: t("colorLight"), icon: "solar:sun-bold-duotone" },
                  { mode: "dark" as const, label: t("colorDark"), icon: "solar:moon-bold-duotone" },
                ]).map((item) => ({ value: item.mode, label: item.label, content: <><span className="settings-choice-icon"><Icon icon={item.icon} width={16} height={16} /></span><strong>{item.label}</strong></> }))}
              />
            </section>

            <section className="settings-card">
              <header className="settings-card-head">
                <SettingsCardTitle icon="solar:pallete-2-bold-duotone">{t("settingsAccent")}</SettingsCardTitle>
              </header>
              <SettingsChoiceGroup
                label={t("settingsAccent")}
                value={themeSettings.accentColor}
                className="settings-accent-row"
                optionClassName="settings-accent-swatch"
                onChange={(accentColor) => setThemeSettings(updateThemeSettings({ accentColor }))}
                options={ACCENT_COLORS.map((color) => {
                  const labelKey = `accent${color[0].toUpperCase()}${color.slice(1)}` as TranslationKey;
                  return { value: color, label: t(labelKey), style: { background: `oklch(0.62 ${ACCENT_CHROMA[color]} ${ACCENT_HUES[color]})` }, content: <span className="settings-visually-hidden">{t(labelKey)}</span> };
                })}
              />
            </section>

            <section className="settings-card">
              <header className="settings-card-head">
                <SettingsCardTitle icon="solar:slider-minimalistic-horizontal-bold-duotone">{t("settingsDensity")}</SettingsCardTitle>
              </header>
              <SettingsChoiceGroup
                label={t("settingsDensity")}
                value={themeSettings.density}
                onChange={(density) => setThemeSettings(updateThemeSettings({ density }))}
                options={([
                  { d: "cozy" as const, label: t("densityCozy"), icon: "solar:widget-bold-duotone" },
                  { d: "compact" as const, label: t("densityCompact"), icon: "solar:slider-minimalistic-horizontal-bold-duotone" },
                ]).map((item) => ({ value: item.d, label: item.label, content: <><span className="settings-choice-icon"><Icon icon={item.icon} width={16} height={16} /></span><strong>{item.label}</strong></> }))}
              />
            </section>

            <section className="settings-card">
              <header className="settings-card-head">
                <SettingsCardTitle icon="solar:gallery-bold-duotone">{t("settingsWallpaper")}</SettingsCardTitle>
                <div className="settings-card-actions">
                  <button type="button" className="settings-btn-pill" onClick={syncWallpapers}>{t("settingsWallpaperSync")}</button>
                  <button type="button" className="settings-btn-pill" onClick={() => randomizeWallpaper("light")}>{t("settingsWallpaperRandom")}</button>
                </div>
              </header>
              {(["light", "dark"] as const).map((target) => (
                  <fieldset key={target} className="settings-subsection wallpaper-mode-section settings-choice-fieldset">
                    <legend className="settings-group-legend">{t(target === "light" ? "settingsWallpaperLight" : "settingsWallpaperDark")}</legend>
                  {Object.entries(wallpaperGroups).map(([categoryKey, entries]) => (
                    <section key={`${target}-${categoryKey}`} className="wallpaper-group">
                      <h4>{t(categoryKey as TranslationKey)}</h4>
                      <div className="wallpaper-grid">
                        {entries.map(([id, wallpaper]) => {
                          const activeWallpaperId = target === "light" ? themeSettings.wallpaperLightId : themeSettings.wallpaperDarkId;
                          return (
                            <label
                              key={`${target}-${id}`}
                              className={clsx("wallpaper-option", activeWallpaperId === id && "is-active")}
                              style={wallpaper.url ? { backgroundImage: `linear-gradient(180deg, oklch(0 0 0 / 0.08), oklch(0 0 0 / 0.44)), url("${wallpaper.url}")` } : undefined}
                            >
                              <input
                                type="radio"
                                name={`settings-wallpaper-${target}`}
                                value={id}
                                checked={activeWallpaperId === id}
                                onChange={() => void setWallpaper(target, id)}
                              />
                              <span>{t(wallpaper.labelKey)}</span>
                            </label>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                  </fieldset>
              ))}
              <div className="settings-split-row">
                <div>
                  <h4>{t("wallpaperFit")}</h4>
                  <SettingsChoiceGroup
                    label={t("wallpaperFit")}
                    value={themeSettings.wallpaperFit}
                    className="settings-select-group"
                    optionClassName="settings-btn-pill"
                    onChange={(wallpaperFit) => setThemeSettings(updateThemeSettings({ wallpaperFit }))}
                    options={(["cover", "contain", "stretch", "tile"] as const).map((fit) => ({ value: fit, label: t(fit === "cover" ? "wallpaperFitCover" : fit === "contain" ? "wallpaperFitContain" : fit === "stretch" ? "wallpaperFitStretch" : "wallpaperFitTile") }))}
                  />
                </div>
                <div>
                  <h4>{t("settingsWallpaperOverlay")}</h4>
                  <SettingsChoiceGroup
                    label={t("settingsWallpaperOverlay")}
                    value={themeSettings.wallpaperOverlay}
                    className="settings-select-group"
                    optionClassName="settings-btn-pill"
                    onChange={(wallpaperOverlay) => setThemeSettings(updateThemeSettings({ wallpaperOverlay }))}
                    options={(["off", "soft", "standard"] as const).map((overlay) => ({ value: overlay, label: t(overlay === "off" ? "wallpaperOverlayOff" : overlay === "soft" ? "wallpaperOverlaySoft" : "wallpaperOverlayStandard") }))}
                  />
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {section === "notifications" ? (
          <div className="settings-stack">
            <header className="settings-pane-head">
              <h2 id="settings-heading-notifications">{t("settingsNavNotifications")}</h2>
            </header>

            <section className="settings-card">
              <div className="settings-row-line">
                <SettingsRowLabel icon="solar:moon-sleep-bold-duotone">{t("notificationDndToggle")}</SettingsRowLabel>
                <SettingsSwitch checked={dndEnabled} label={t("notificationDndToggle")} onChange={(checked) => setNotificationPrefs({ dndEnabled: checked })} />
              </div>
            </section>

            <section className="settings-card">
              <header className="settings-card-head">
                <SettingsCardTitle icon="solar:calendar-bold-duotone">{t("settingsDndSchedule")}</SettingsCardTitle>
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
                <SettingsCardTitle icon="solar:bell-bold-duotone">{t("settingsBannerDuration")}</SettingsCardTitle>
              </header>
              <SettingsChoiceGroup
                label={t("settingsBannerDuration")}
                value={notificationPrefs.bannerDuration}
                className="settings-select-group"
                optionClassName="settings-btn-pill"
                onChange={(bannerDuration) => setNotificationPrefs({ bannerDuration })}
                options={([
                  { id: "short" as BannerDuration, label: t("settingsBannerShort") },
                  { id: "standard" as BannerDuration, label: t("settingsBannerStandard") },
                  { id: "long" as BannerDuration, label: t("settingsBannerLong") },
                ]).map((item) => ({ value: item.id, label: item.label }))}
              />
            </section>

            <section className="settings-card">
              <header className="settings-card-head">
                <SettingsCardTitle icon="solar:checklist-minimalistic-bold-duotone">{t("settingsNotifyCategories")}</SettingsCardTitle>
              </header>
              {([
                { id: "system" as NotificationCategory, label: t("notificationCategorySystem"), icon: "solar:monitor-bold-duotone" },
                { id: "files" as NotificationCategory, label: t("notificationCategoryFiles"), icon: "solar:folder-bold-duotone" },
                { id: "apps" as NotificationCategory, label: t("notificationCategoryApps"), icon: "solar:widget-2-bold-duotone" },
                { id: "media" as NotificationCategory, label: t("notificationCategoryMedia"), icon: "solar:play-circle-bold-duotone" },
              ]).map((item) => (
                <div key={item.id} className="settings-row-line">
                  <SettingsRowLabel icon={item.icon}>{item.label}</SettingsRowLabel>
                  <SettingsSwitch
                    checked={notificationPrefs.categories[item.id]}
                    label={item.label}
                    onChange={(checked) =>
                      setNotificationPrefs((current) => ({
                        ...current,
                        categories: {
                          ...current.categories,
                          [item.id]: checked,
                        },
                      }))
                    }
                  />
                </div>
              ))}
            </section>
          </div>
        ) : null}

        {section === "network" ? (
          <div className="settings-stack">
            <header className="settings-pane-head">
              <h2 id="settings-heading-network">{t("settingsNavNetwork")}</h2>
              <button type="button" className="settings-btn-pill" disabled={networkBusy} onClick={() => void refreshNetwork()}>
                {networkBusy
                  ? t("settingsNetworkRefreshing")
                  : network
                    ? t("settingsNetworkRefresh")
                    : t("settingsNetworkRunDiagnostics")}
              </button>
            </header>

            <p className="settings-inline-hint">{t("settingsNetworkDiagnosticsPrivacy")}</p>
            <div aria-live="polite">
              {networkBusy ? <p className="settings-inline-hint">{t("settingsNetworkRefreshing")}</p> : null}
              {networkError ? <p className="settings-inline-hint settings-error-text">{t("settingsNetworkDiagnosticsFailed")}</p> : null}
              {!network && !networkBusy && !networkError ? <p className="settings-inline-hint">{t("settingsNetworkDiagnosticsIdle")}</p> : null}
            </div>
            {network ? (
              <dl className="settings-kv settings-kv-plain">
                {([
                  [t("settingsNetworkStatus"), network.online ? t("settingsNetworkOnline") : t("settingsNetworkOffline")],
                  [t("settingsNetworkType"), formatConnectionType(network.connectionType)],
                  [t("settingsNetworkPublicIp"), dash(network.publicIp)],
                  [t("settingsNetworkPublicIpSource"), dash(network.publicIpSource)],
                  [t("settingsNetworkMeasuredRtt"), network.measuredRttMs != null ? `${network.measuredRttMs} ms` : "—"],
                  [t("settingsNetworkLanIp"), network.lanIps.length ? network.lanIps.join(", ") : "—"],
                  [t("settingsNetworkLocalIp"), network.localIps.length ? network.localIps.join(", ") : network.mdnsHosts.length ? network.mdnsHosts.join(", ") : "—"],
                  [t("settingsNetworkEffective"), formatEffectiveType(network.effectiveType)],
                  [t("settingsNetworkDownlink"), network.downlinkMbps != null ? `${network.downlinkMbps} Mbps` : "—"],
                  [t("settingsNetworkRtt"), network.rttMs != null ? `${network.rttMs} ms` : "—"],
                  [t("settingsNetworkSaveData"), network.saveData ? t("yes") : t("no")],
                  [t("settingsNetworkPageHost"), dash(network.pageHost)],
                  [t("settingsNetworkPageProtocol"), dash(network.pageProtocol)],
                ] as const).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd title={value}>{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        ) : null}

        {section === "data" ? (
          <div className="settings-stack">
            <header className="settings-pane-head">
              <h2 id="settings-heading-data">{t("settingsNavData")}</h2>
            </header>

            <dl className="settings-kv settings-kv-plain">
              <div>
                <dt>{t("dataOriginStorage")}</dt>
                <dd>{getStorageLabel(storage ?? null)}</dd>
              </div>
            </dl>

            <section className="settings-card">
              <p className="settings-inline-hint">{t("settingsBackupScope")}</p>
              <div className="settings-row-line">
                <SettingsRowLabel icon="solar:download-minimalistic-bold-duotone">{t("settingsExport")}</SettingsRowLabel>
                <button type="button" className="settings-btn-pill" disabled={settingsTransferBusy} onClick={exportSettings}>
                  {settingsTransferBusy ? t("settingsTransferring") : t("settingsExport")}
                </button>
              </div>
              <div className="settings-row-line">
                <SettingsRowLabel icon="solar:upload-minimalistic-bold-duotone">{t("settingsImport")}</SettingsRowLabel>
                <button type="button" className="settings-btn-pill" disabled={settingsTransferBusy} onClick={() => importInputRef.current?.click()}>
                  {settingsTransferBusy ? t("settingsTransferring") : t("settingsImport")}
                </button>
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
                <SettingsRowLabel icon="solar:trash-bin-trash-bold-duotone">{t("clearCache")}</SettingsRowLabel>
                <button type="button" className="settings-btn-pill" onClick={() => void clearCacheStorage()}>{t("clearCache")}</button>
              </div>
              <div className="settings-row-line">
                <SettingsRowLabel icon="solar:folder-with-files-bold-duotone">{t("virtualFiles")}</SettingsRowLabel>
                <button type="button" className="settings-btn-pill" onClick={() => void resetLocalFiles()}>{t("resetFiles")}</button>
              </div>
              <div className="settings-row-line">
                <SettingsRowLabel icon="solar:database-bold-duotone">{t("siteData")}</SettingsRowLabel>
                <button
                  type="button"
                  className="settings-btn-pill"
                  disabled={siteDataBusy}
                  onClick={() => void clearSiteData()}
                >
                  {siteDataBusy ? t("settingsResetting") : t("clearSiteData")}
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {section === "developer" ? (
          <div className="settings-stack">
            <header className="settings-pane-head">
              <h2 id="settings-heading-developer">{t("settingsNavDeveloper")}</h2>
            </header>

            <section className="settings-card">
              <header className="settings-card-head">
                <SettingsCardTitle icon="solar:play-circle-bold-duotone">{t("settingsAnimationQuality")}</SettingsCardTitle>
              </header>
              <SettingsChoiceGroup
                label={t("settingsAnimationQuality")}
                value={developerPrefs.animationQuality}
                onChange={(animationQuality) => setDeveloperPrefs({ animationQuality })}
                options={([
                  { id: "fluid" as const, label: t("settingsAnimationFluid"), icon: "solar:bolt-bold-duotone" },
                  { id: "power" as const, label: t("settingsAnimationPower"), icon: "solar:battery-charge-bold-duotone" },
                ]).map((item) => ({ value: item.id, label: item.label, content: <><span className="settings-choice-icon"><Icon icon={item.icon} width={16} height={16} /></span><strong>{item.label}</strong></> }))}
              />
            </section>

            <section className="settings-card">
              <div className="settings-row-line">
                <SettingsRowLabel icon="solar:graph-up-bold-duotone">{t("settingsShowFps")}</SettingsRowLabel>
                <SettingsSwitch checked={developerPrefs.showFps} label={t("settingsShowFps")} onChange={(checked) => setDeveloperPrefs({ showFps: checked })} />
              </div>
              <div className="settings-row-line">
                <SettingsRowLabel icon="solar:ruler-cross-pen-bold-duotone">{t("settingsDebugBorders")}</SettingsRowLabel>
                <SettingsSwitch checked={developerPrefs.debugBorders} label={t("settingsDebugBorders")} onChange={(checked) => setDeveloperPrefs({ debugBorders: checked })} />
              </div>
            </section>

            <section className="settings-card">
              <header className="settings-card-head">
                <SettingsCardTitle icon="solar:glasses-bold-duotone">{t("settingsVrDesktop")}</SettingsCardTitle>
                <span className="settings-badge-muted">{t("settingsVrDesktopExperimental")}</span>
              </header>
              <div className="settings-row-line">
                <SettingsRowLabel icon="solar:settings-bold-duotone">{t("vrDesktopSettingsLead")}</SettingsRowLabel>
                <button type="button" className="settings-btn-pill" onClick={() => openApp("vr-desktop")}>{t("vrDesktopSettingsOpen")}</button>
              </div>
            </section>

          </div>
        ) : null}

        {section === "about" ? (
          <div className="settings-stack">
            <header className="settings-pane-head">
              <h2 id="settings-heading-about">{t("settingsNavAbout")}</h2>
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
