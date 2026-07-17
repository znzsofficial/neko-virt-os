import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import { useEffect, useMemo, useState } from "react";
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
import { useOsUiStore } from "../osUiStore";
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
  const dndEnabled = useOsUiStore((state) => state.notificationPrefs.dndEnabled);
  const dndStart = useOsUiStore((state) => state.notificationPrefs.dndStart);
  const dndEnd = useOsUiStore((state) => state.notificationPrefs.dndEnd);
  const setNotificationPrefs = useOsUiStore((state) => state.setNotificationPrefs);
  const developerPrefs = useOsUiStore((state) => state.developerPrefs);
  const setDeveloperPrefs = useOsUiStore((state) => state.setDeveloperPrefs);

  useEffect(() => {
    navigator.storage?.estimate().then(setStorage).catch(() => setStorage(null));
    void readHighEntropyDeviceInfo().then(setDeviceInfo);
  }, []);

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
