import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { appConfirm } from "../dialogStore";
import { useFsStore } from "../fs";
import { useLanguageStore, type TranslationKey } from "../languageStore";
import { phrase } from "../shell/phrase";
import {
  collectNetworkSnapshot,
  subscribeNetworkChange,
  type NetworkSnapshot,
} from "../system/networkInfo";
import { useNotificationStore } from "../notificationStore";
import { useOsUiStore } from "../osUiStore";
import {
  applySettingsBackup,
  downloadSettingsBackup,
  parseSettingsBackup,
} from "../system/settingsBackup";
import { resetSiteData } from "../system/siteDataReset";
import {
  applyThemeSettings,
  readThemeSettings,
  resolveThemeMode,
  subscribeThemeSettings,
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
import { isValidNotificationTime } from "../system/notificationPrefs";
import { getWallpaperFallbackId, preloadWallpaperImage } from "../system/wallpaperPolicy";
import { useDesktopStore } from "../windowStore";
import { consumeSettingsSection, subscribeSettingsSection, type SettingsSection } from "./settings/settingsNavigation";
import { filterSettingsSearch, type SettingsSearchEntry } from "./settings/settingsSearch";
import { AboutSettings } from "./settings/sections/AboutSettings";
import { AppearanceSettings } from "./settings/sections/AppearanceSettings";
import { DataSettings } from "./settings/sections/DataSettings";
import { DeveloperSettings } from "./settings/sections/DeveloperSettings";
import { GeneralSettings } from "./settings/sections/GeneralSettings";
import { NetworkSettings } from "./settings/sections/NetworkSettings";
import { NotificationSettings } from "./settings/sections/NotificationSettings";

function dash(value: string | number | null | undefined, empty = "—") {
  if (value == null || value === "" || value === "—") return empty;
  return String(value);
}

export function SettingsApp() {
  const [section, setSection] = useState<SettingsSection>(() => consumeSettingsSection("general"));
  const [searchQuery, setSearchQuery] = useState("");
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(readThemeSettings);
  const [storage, setStorage] = useState<StorageSnapshot | null | undefined>(undefined);
  const [deviceInfo, setDeviceInfo] = useState<DeviceSnapshot | undefined>();
  const [network, setNetwork] = useState<NetworkSnapshot | null>(null);
  const [networkBusy, setNetworkBusy] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [cacheBusy, setCacheBusy] = useState(false);
  const [virtualFilesBusy, setVirtualFilesBusy] = useState(false);
  const [siteDataBusy, setSiteDataBusy] = useState(false);
  const [settingsTransferBusy, setSettingsTransferBusy] = useState(false);
  const [wallpaperBusy, setWallpaperBusy] = useState<"light" | "dark" | null>(null);

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
  const wallpaperGenerationRef = useRef(0);
  const destructiveActionRef = useRef<"cache" | "files" | "site" | null>(null);
  const settingsMainRef = useRef<HTMLDivElement>(null);

  function updateDndTime(field: "dndStart" | "dndEnd", value: string) {
    if (!isValidNotificationTime(value)) return;
    setNotificationPrefs({ [field]: value });
  }

  useEffect(() => subscribeSettingsSection(setSection), []);
  useEffect(() => subscribeThemeSettings(setThemeSettings), []);

  useEffect(() => () => {
    wallpaperGenerationRef.current += 1;
  }, []);

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
    if (cacheBusy || destructiveActionRef.current) return;
    if (!("caches" in window)) {
      addNotification({ title: t("cacheUnavailable"), message: t("cacheUnavailableMessage"), type: "warning", category: "system", appId: "settings" });
      return;
    }
    destructiveActionRef.current = "cache";
    try {
      const ok = await appConfirm({
        title: t("dialogConfirmTitle"),
        message: t("confirmClearCache"),
        confirmLabel: t("dialogConfirm"),
        danger: true,
      });
      if (!ok) return;
      setCacheBusy(true);
      const keys = await caches.keys();
      const results = await Promise.all(keys.map((key) => caches.delete(key)));
      if (results.some((deleted) => !deleted)) throw new Error("cache-delete-failed");
      navigator.storage?.estimate().then(setStorage).catch(() => setStorage(null));
      addNotification({ title: t("cacheCleared"), message: phrase(t, "cacheClearedPrefix", keys.length, "cacheClearedSuffix"), type: "success", category: "system", appId: "settings" });
    } catch {
      addNotification({ title: t("cacheClearFailed"), message: t("cacheClearFailedMessage"), type: "error", category: "system", appId: "settings" });
    } finally {
      setCacheBusy(false);
      destructiveActionRef.current = null;
    }
  }

  async function resetLocalFiles() {
    if (virtualFilesBusy || destructiveActionRef.current) return;
    destructiveActionRef.current = "files";
    try {
      const ok = await appConfirm({
        title: t("dialogConfirmTitle"),
        message: t("confirmResetFiles"),
        confirmLabel: t("dialogConfirm"),
        danger: true,
      });
      if (!ok) return;
      setVirtualFilesBusy(true);
      await resetVirtualFiles();
      navigator.storage?.estimate().then(setStorage).catch(() => setStorage(null));
      addNotification({ title: t("virtualStorageReset"), message: t("virtualStorageResetMessage"), type: "success", category: "system", appId: "settings" });
    } catch {
      addNotification({ title: t("virtualStorageResetFailed"), message: t("virtualStorageResetFailedMessage"), type: "error", category: "system", appId: "settings" });
    } finally {
      setVirtualFilesBusy(false);
      destructiveActionRef.current = null;
    }
  }

  async function clearSiteData() {
    if (siteDataBusy || destructiveActionRef.current) return;
    destructiveActionRef.current = "site";
    try {
      const ok = await appConfirm({
        title: t("dialogConfirmTitle"),
        message: t("confirmClearSiteData"),
        confirmLabel: t("dialogConfirm"),
        danger: true,
      });
      if (!ok) return;
      setSiteDataBusy(true);
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
    } finally {
      setSiteDataBusy(false);
      destructiveActionRef.current = null;
    }
  }

  async function setWallpaper(target: "light" | "dark", wallpaperId: ThemeSettings["wallpaperId"]) {
    const generation = ++wallpaperGenerationRef.current;
    setWallpaperBusy(target);
    const online = typeof navigator === "undefined" || navigator.onLine;
    const selectedWallpaperId = wallpaperId;
    const wallpaper = WALLPAPERS[selectedWallpaperId];
    try {
      if (online && selectedWallpaperId !== "system" && wallpaper.url) {
        const url = wallpaper.url;
        const loaded = await preloadWallpaperImage(url);
        if (generation !== wallpaperGenerationRef.current) return;
        if (!loaded) {
          const fallback = getWallpaperFallbackId(wallpaperId, false);
          const fallbackSettings = updateThemeSettings({
            wallpaperId: fallback,
            ...(target === "light" ? { wallpaperLightId: fallback } : { wallpaperDarkId: fallback }),
          });
          setThemeSettings(fallbackSettings);
          addNotification({ title: t("wallpaperLoadFailed"), message: t("wallpaperFallbackMessage"), type: "warning", category: "system", appId: "settings" });
          return;
        }
      }
      const next = updateThemeSettings({
        wallpaperId: selectedWallpaperId,
        ...(target === "light" ? { wallpaperLightId: selectedWallpaperId } : { wallpaperDarkId: selectedWallpaperId }),
      });
      setThemeSettings(next);
    } finally {
      if (generation === wallpaperGenerationRef.current) setWallpaperBusy(null);
    }
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
  const aboutRows = useMemo(() => getDeviceRows(storage ?? null, deviceInfo, t) as [string, string][], [deviceInfo, storage, t]);

  function syncWallpapers() {
    const sourceId = effectiveTheme === "dark" ? themeSettings.wallpaperDarkId : themeSettings.wallpaperLightId;
    const nextSettings = updateThemeSettings({
      wallpaperId: sourceId,
      wallpaperLightId: sourceId,
      wallpaperDarkId: sourceId,
    });
    setThemeSettings(nextSettings);
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

  const searchItems = useMemo<readonly SettingsSearchEntry[]>(() => [
    ["general", "settingsLanguage"], ["general", "settingsTimeFormat"], ["general", "settingsAutoLock"],
    ["general", "settingsTaskbarLabels"], ["general", "settingsDesktopWidgets"], ["general", "settingsDesktopLayout"], ["general", "settingsAccessibility"],
    ["appearance", "settingsTheme"], ["appearance", "settingsAccent"], ["appearance", "settingsDensity"], ["appearance", "settingsWallpaper"], ["appearance", "wallpaperFit"], ["appearance", "settingsWallpaperOverlay"],
    ["notifications", "notificationDndToggle"], ["notifications", "settingsDndSchedule"], ["notifications", "settingsBannerDuration"], ["notifications", "settingsNotifyCategories"],
    ["network", "settingsNetworkRunDiagnostics"], ["network", "settingsNetworkStatus"], ["network", "settingsNetworkPublicIp"],
    ["data", "settingsExport"], ["data", "settingsImport"], ["data", "clearCache"], ["data", "virtualFiles"], ["data", "siteData"],
    ["developer", "settingsAnimationQuality"], ["developer", "settingsShowFps"], ["developer", "settingsDebugBorders"], ["developer", "settingsVrDesktop"],
    ["about", "aboutOpenSource"], ["about", "version"], ["about", "processor"],
  ], []);
  const searchResults = filterSettingsSearch(searchItems, searchQuery, t);

  function openSearchResult(nextSection: SettingsSection) {
    setSection(nextSection);
    window.setTimeout(() => {
      const heading = settingsMainRef.current?.querySelector<HTMLElement>("h2");
      heading?.scrollIntoView({ block: "start" });
    }, 0);
  }

  return (
    <div className="settings-app settings-shell">
      <aside className="settings-nav" aria-label={t("appSettings")}>
        <label className="settings-search">
          <Icon icon="solar:magnifer-linear" width={16} height={16} />
          <input
            type="search"
            value={searchQuery}
            placeholder={t("settingsSearchPlaceholder")}
            aria-label={t("settingsSearch")}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>
        {searchResults.length ? (
          <div className="settings-search-results" role="list" aria-label={t("settingsSearchResults")}>
            {searchResults.map(([resultSection, key]) => (
              <button key={`${resultSection}-${key}`} type="button" onClick={() => openSearchResult(resultSection)}>
                <span>{t(key)}</span>
                <small>{t(navItems.find((item) => item.id === resultSection)?.label ?? "settingsNavGeneral")}</small>
              </button>
            ))}
          </div>
        ) : searchQuery.trim() ? <p className="settings-search-empty">{t("settingsSearchNoResults")}</p> : null}
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

      <div ref={settingsMainRef} className="settings-main" id={`settings-panel-${section}`} aria-labelledby={`settings-heading-${section}`}>
        {section === "general" ? (
          <GeneralSettings
            t={t}
            language={language}
            setLanguage={setLanguage}
            systemPrefs={systemPrefs}
            setSystemPrefs={setSystemPrefs}
            developerPrefs={developerPrefs}
            setDeveloperPrefs={setDeveloperPrefs}
            widgetsCollapsed={widgetsCollapsed}
            setWidgetsCollapsed={setWidgetsCollapsed}
            desktopLayoutMode={desktopLayoutMode}
            setDesktopLayoutMode={setDesktopLayoutMode}
          />
        ) : null}

        {section === "appearance" ? (
          <AppearanceSettings
            t={t}
            themeSettings={themeSettings}
            setThemeSettings={setThemeSettings}
            updateThemeSettings={updateThemeSettings}
            wallpaperGroups={wallpaperGroups}
            wallpaperBusy={wallpaperBusy}
            setWallpaper={setWallpaper}
            syncWallpapers={syncWallpapers}
            randomizeWallpaper={randomizeWallpaper}
          />
        ) : null}

        {section === "notifications" ? (
          <NotificationSettings
            t={t}
            notificationPrefs={notificationPrefs}
            setNotificationPrefs={setNotificationPrefs}
            updateDndTime={updateDndTime}
          />
        ) : null}

        {section === "network" ? (
          <NetworkSettings
            t={t}
            network={network}
            networkBusy={networkBusy}
            networkError={networkError}
            refreshNetwork={() => void refreshNetwork()}
            dash={dash}
          />
        ) : null}

        {section === "data" ? (
          <DataSettings
            t={t}
            storageLabel={getStorageLabel(storage ?? null)}
            settingsTransferBusy={settingsTransferBusy}
            exportSettings={exportSettings}
            importSettingsFile={importSettingsFile}
            importInputRef={importInputRef}
            cacheBusy={cacheBusy}
            clearCacheStorage={clearCacheStorage}
            virtualFilesBusy={virtualFilesBusy}
            resetLocalFiles={resetLocalFiles}
            siteDataBusy={siteDataBusy}
            clearSiteData={clearSiteData}
          />
        ) : null}

        {section === "developer" ? (
          <DeveloperSettings t={t} developerPrefs={developerPrefs} setDeveloperPrefs={setDeveloperPrefs} openApp={openApp} />
        ) : null}

        {section === "about" ? (
          <AboutSettings t={t} aboutRows={aboutRows} />
        ) : null}
      </div>
    </div>
  );
}
