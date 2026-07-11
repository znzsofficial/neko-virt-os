import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { useFsStore } from "../fsStore";
import { useLanguageStore, type TranslationKey } from "../languageStore";
import { useNotificationStore } from "../notificationStore";
import { ACCENT_HUES, applyThemeSettings, readThemeSettings, resolveThemeMode, THEME_STORAGE_KEY, WALLPAPERS } from "../theme";
import type { ThemeSettings } from "../types";
import { getStorageLabel, type StorageSnapshot } from "../systemInfo";
import { useDesktopStore } from "../windowStore";

function phrase(t: (key: TranslationKey) => string, prefix: TranslationKey, value: string | number, suffix: TranslationKey) {
  return `${t(prefix)}${value}${t(suffix)}`;
}

export function SettingsApp() {
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(readThemeSettings);
  const [storage, setStorage] = useState<StorageSnapshot | null>(null);

  const addNotification = useNotificationStore((state) => state.addNotification);
  const resetVirtualFiles = useFsStore((state) => state.resetVirtualFiles);
  const resetWindowLayout = useDesktopStore((state) => state.resetWindowLayout);
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const t = useLanguageStore((state) => state.t);

  useEffect(() => {
    navigator.storage?.estimate().then(setStorage).catch(() => setStorage(null));
  }, []);

  useEffect(() => {
    applyThemeSettings(themeSettings);
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themeSettings));
  }, [themeSettings]);

  async function clearCacheStorage() {
    if (!("caches" in window)) {
      addNotification({ title: t("cacheUnavailable"), message: t("cacheUnavailableMessage"), type: "warning" });
      return;
    }
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    navigator.storage?.estimate().then(setStorage).catch(() => setStorage(null));
    addNotification({ title: t("cacheCleared"), message: phrase(t, "cacheClearedPrefix", keys.length, "cacheClearedSuffix"), type: "success" });
  }

  async function resetLocalFiles() {
    if (!window.confirm(t("confirmResetFiles"))) return;
    await resetVirtualFiles();
    navigator.storage?.estimate().then(setStorage).catch(() => setStorage(null));
    addNotification({ title: t("virtualStorageReset"), message: t("virtualStorageResetMessage"), type: "success" });
  }

  async function clearSiteData() {
    if (!window.confirm(t("confirmClearSiteData"))) return;
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    localStorage.clear();
    resetWindowLayout();
    await resetVirtualFiles();
    addNotification({ title: t("siteDataCleared"), message: t("siteDataClearedMessage"), type: "success" });
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
        addNotification({ title: t("wallpaperLoadFailed"), message: t("wallpaperLoadFailedMessage"), type: "warning" });
        return;
      }
    }
    setThemeSettings((prev: ThemeSettings) => ({
      ...prev,
      wallpaperId,
      wallpaperLightId: target === "light" ? wallpaperId : prev.wallpaperLightId,
      wallpaperDarkId: target === "dark" ? wallpaperId : prev.wallpaperDarkId,
    }));
    addNotification({
      title: t("wallpaperChanged"),
      message: phrase(t, "wallpaperChangedPrefix", t(wallpaper.labelKey), "wallpaperChangedSuffix"),
      type: "info",
    });
  }

  const effectiveTheme = resolveThemeMode(themeSettings.theme);
  const tokens = [
    ["Primary", `oklch(0.520 0.145 ${ACCENT_HUES[themeSettings.accentColor]})`, "kernel"],
    ["Accent", `oklch(${effectiveTheme === "dark" ? "0.760" : "0.650"} 0.115 ${ACCENT_HUES[themeSettings.accentColor]})`, "focus"],
    ["Panel", effectiveTheme === "dark" ? "oklch(0.190 0.010 255)" : "oklch(0.910 0.012 255)", "surface"],
  ] as const;
  const wallpaperEntries = Object.entries(WALLPAPERS) as [ThemeSettings["wallpaperId"], (typeof WALLPAPERS)[ThemeSettings["wallpaperId"]]][];
  const wallpaperGroups = wallpaperEntries.reduce<Record<string, typeof wallpaperEntries>>((groups, entry) => {
    const key = entry[1].categoryKey;
    groups[key] ??= [];
    groups[key].push(entry);
    return groups;
  }, {});
  const randomWallpaperIds = wallpaperEntries.map(([id]) => id);

  function syncWallpapers() {
    const sourceId = effectiveTheme === "dark" ? themeSettings.wallpaperDarkId : themeSettings.wallpaperLightId;
    const nextSettings = {
      ...themeSettings,
      wallpaperId: sourceId,
      wallpaperLightId: sourceId,
      wallpaperDarkId: sourceId,
    } satisfies ThemeSettings;
    setThemeSettings(nextSettings);
    applyThemeSettings(nextSettings);
  }

  function randomizeWallpaper(target: "light" | "dark") {
    const nextId = randomWallpaperIds[Math.floor(Math.random() * randomWallpaperIds.length)] ?? "system";
    void setWallpaper(target, nextId);
  }

  return (
    <div className="settings-app">
      <section className="settings-hero">
        <Icon icon="solar:cat-bold-duotone" width={42} height={42} />
        <div>
          <h2>{t("settingsHeroTitle")}</h2>
          <p>{t("settingsHeroDescription")}</p>
        </div>
      </section>

      <h3 className="settings-section-title">{t("settingsLanguage")}</h3>
      <div className="settings-select-group">
        {(["zh", "en"] as const).map((lang) => (
          <button
            key={lang}
            className={clsx("settings-btn-pill", language === lang && "is-active")}
            onClick={() => {
              setLanguage(lang);
              const nextT = useLanguageStore.getState().t;
              addNotification({
                title: nextT("languageChanged"),
                message: lang === "zh" ? nextT("languageChangedZhMessage") : nextT("languageChangedEnMessage"),
                type: "info",
              });
            }}
          >
            {lang === "zh" ? t("languageChinese") : t("languageEnglish")}
          </button>
        ))}
      </div>

      <h3 className="settings-section-title">{t("settingsTheme")}</h3>
      <div className="settings-select-group">
        {(["system", "light", "dark"] as const).map((mode) => (
          <button
            key={mode}
            className={clsx("settings-btn-pill", themeSettings.theme === mode && "is-active")}
            onClick={() => {
              setThemeSettings((prev: ThemeSettings) => ({ ...prev, theme: mode }));
              addNotification({
                title: t("themeChanged"),
                message: phrase(t, "themeChangedPrefix", mode === "system" ? t("colorSystem") : mode === "light" ? t("colorLight") : t("colorDark"), "themeChangedSuffix"),
                type: "info",
              });
            }}
          >
            {mode === "system" ? t("colorSystem") : mode === "light" ? t("colorLight") : t("colorDark")}
          </button>
        ))}
      </div>

      <h3 className="settings-section-title">{t("settingsAccent")}</h3>
      <div className="settings-select-group">
        {(["blue", "purple", "emerald", "amber"] as const).map((color) => (
          <button
            key={color}
            className={clsx("settings-btn-pill", themeSettings.accentColor === color && "is-active")}
            onClick={() => {
              setThemeSettings((prev: ThemeSettings) => ({ ...prev, accentColor: color }));
              addNotification({
                title: t("accentUpdated"),
                message: phrase(t, "accentUpdatedPrefix", color, "accentUpdatedSuffix"),
                type: "info",
              });
            }}
          >
            {color.charAt(0).toUpperCase() + color.slice(1)}
          </button>
        ))}
      </div>

      <h3 className="settings-section-title">{t("settingsWallpaper")}</h3>
      <div className="settings-select-group wallpaper-quick-actions">
        <button type="button" className="settings-btn-pill" onClick={syncWallpapers}>{t("settingsWallpaperSync")}</button>
        <button type="button" className="settings-btn-pill" onClick={() => randomizeWallpaper("light")}>{t("settingsWallpaperRandom")} · {t("colorLight")}</button>
        <button type="button" className="settings-btn-pill" onClick={() => randomizeWallpaper("dark")}>{t("settingsWallpaperRandom")} · {t("colorDark")}</button>
      </div>
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
                      className={clsx("wallpaper-option", activeWallpaperId === id && "is-active")}
                      onClick={() => void setWallpaper(target, id)}
                      style={wallpaper.url ? { backgroundImage: `linear-gradient(180deg, oklch(0 0 0 / 0.08), oklch(0 0 0 / 0.44)), url("${wallpaper.url}")` } : undefined}
                    >
                      <span>{t(wallpaper.labelKey)}</span>
                      <small>{wallpaper.source === "unsplash" ? t("wallpaperSourceUnsplash") : t("wallpaperSourceBuiltIn")}</small>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ))}

      <div className="settings-subsection">
        <h4>{t("wallpaperFit")}</h4>
        <div className="settings-select-group">
          {(["cover", "contain", "stretch", "tile"] as const).map((fit) => (
            <button
              key={fit}
              className={clsx("settings-btn-pill", themeSettings.wallpaperFit === fit && "is-active")}
              onClick={() => {
                const nextSettings = { ...themeSettings, wallpaperFit: fit } satisfies ThemeSettings;
                setThemeSettings(nextSettings);
                applyThemeSettings(nextSettings);
                addNotification({
                  title: t("wallpaperChanged"),
                  message: phrase(t, "wallpaperChangedPrefix", t(fit === "cover" ? "wallpaperFitCover" : fit === "contain" ? "wallpaperFitContain" : fit === "stretch" ? "wallpaperFitStretch" : "wallpaperFitTile"), "wallpaperChangedSuffix"),
                  type: "info",
                });
              }}
            >
              {t(fit === "cover" ? "wallpaperFitCover" : fit === "contain" ? "wallpaperFitContain" : fit === "stretch" ? "wallpaperFitStretch" : "wallpaperFitTile")}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-subsection">
        <h4>{t("settingsWallpaperOverlay")}</h4>
        <div className="settings-select-group">
          {(["off", "soft", "standard"] as const).map((overlay) => (
            <button
              key={overlay}
              className={clsx("settings-btn-pill", themeSettings.wallpaperOverlay === overlay && "is-active")}
              onClick={() => {
                const nextSettings = { ...themeSettings, wallpaperOverlay: overlay } satisfies ThemeSettings;
                setThemeSettings(nextSettings);
                applyThemeSettings(nextSettings);
              }}
            >
              {t(overlay === "off" ? "wallpaperOverlayOff" : overlay === "soft" ? "wallpaperOverlaySoft" : "wallpaperOverlayStandard")}
            </button>
          ))}
        </div>
      </div>

      <h3 className="settings-section-title">{t("settingsDensity")}</h3>
      <div className="settings-select-group">
        {(["cozy", "compact"] as const).map((d) => (
          <button
            key={d}
            className={clsx("settings-btn-pill", themeSettings.density === d && "is-active")}
            onClick={() => {
              setThemeSettings((prev: ThemeSettings) => ({ ...prev, density: d }));
              addNotification({
                title: t("densitySwitched"),
                message: phrase(t, "densitySwitchedPrefix", d === "cozy" ? t("densityCozy") : t("densityCompact"), "densitySwitchedSuffix"),
                type: "info",
              });
            }}
          >
            {d === "cozy" ? t("densityCozy") : t("densityCompact")}
          </button>
        ))}
      </div>

      <h3 className="settings-section-title">{t("settingsTokens")}</h3>
      <div className="settings-list">
        {tokens.map(([label, value, role]) => (
          <div key={label} className="settings-row">
            <span className={clsx("swatch", `swatch-${role}`)} />
            <div>
              <strong>{label}</strong>
              <p>{value}</p>
            </div>
            <button
              className="button-ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(value);
                  addNotification({
                    title: t("copiedToken"),
                    message: `${label}${t("copiedTokenSuffix")}`,
                    type: "success",
                  });
                } catch {
                  addNotification({
                    title: t("copyFailed"),
                    message: t("copyFailedMessage"),
                    type: "error",
                  });
                }
              }}
            >
              {t("copy")}
            </button>
          </div>
        ))}
      </div>

      <h3 className="settings-section-title">{t("settingsData")}</h3>
      <div className="settings-list">
        <div className="settings-row data-row">
          <span className="swatch swatch-surface" />
          <div>
            <strong>{t("dataOriginStorage")}</strong>
            <p>{getStorageLabel(storage)}</p>
          </div>
          <button className="button-ghost" onClick={() => void clearCacheStorage()}>{t("clearCache")}</button>
        </div>
        <div className="settings-row data-row">
          <span className="swatch swatch-focus" />
          <div>
            <strong>{t("virtualFiles")}</strong>
            <p>{t("virtualFilesDescription")}</p>
          </div>
          <button className="button-ghost" onClick={() => void resetLocalFiles()}>{t("resetFiles")}</button>
        </div>
        <div className="settings-row data-row danger-row">
          <span className="swatch swatch-danger" />
          <div>
            <strong>{t("siteData")}</strong>
            <p>{t("siteDataDescription")}</p>
          </div>
          <button className="button-ghost" onClick={() => void clearSiteData()}>{t("clearSiteData")}</button>
        </div>
      </div>
    </div>
  );
}
