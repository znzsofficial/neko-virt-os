import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import type { TranslationKey } from "../../../languageStore";
import type { ThemeSettings } from "../../../types";
import { ACCENT_CHROMA, ACCENT_COLORS, ACCENT_HUES, WALLPAPERS } from "../../../system/theme";
import { SettingsChoiceGroup } from "../components/SettingsControls";

type WallpaperEntry = [ThemeSettings["wallpaperId"], (typeof WALLPAPERS)[ThemeSettings["wallpaperId"]]];
type Props = {
  t: (key: TranslationKey) => string;
  themeSettings: ThemeSettings;
  setThemeSettings: (settings: ThemeSettings) => void;
  updateThemeSettings: (patch: Partial<ThemeSettings>) => ThemeSettings;
  wallpaperGroups: Record<string, WallpaperEntry[]>;
  wallpaperBusy: "light" | "dark" | null;
  setWallpaper: (target: "light" | "dark", id: ThemeSettings["wallpaperId"]) => void;
  syncWallpapers: () => void;
  randomizeWallpaper: (target: "light" | "dark") => void;
};

export function AppearanceSettings({ t, themeSettings, setThemeSettings, updateThemeSettings, wallpaperGroups, wallpaperBusy, setWallpaper, syncWallpapers, randomizeWallpaper }: Props) {
  return <div className="settings-stack">
    <header className="settings-pane-head"><h2 id="settings-heading-appearance">{t("settingsNavAppearance")}</h2></header>
    <section className="settings-card"><header className="settings-card-head"><span className="settings-card-title"><Icon icon="solar:pallete-2-bold-duotone" width={16} height={16} /><strong>{t("settingsTheme")}</strong></span></header>
      <SettingsChoiceGroup label={t("settingsTheme")} value={themeSettings.theme} className="settings-choice-grid cols-3" onChange={(theme) => setThemeSettings(updateThemeSettings({ theme }))} options={[{ value: "system", label: t("colorSystem"), content: <><span className="settings-choice-icon"><Icon icon="solar:laptop-bold-duotone" width={16} height={16} /></span><strong>{t("colorSystem")}</strong></> }, { value: "light", label: t("colorLight"), content: <><span className="settings-choice-icon"><Icon icon="solar:sun-bold-duotone" width={16} height={16} /></span><strong>{t("colorLight")}</strong></> }, { value: "dark", label: t("colorDark"), content: <><span className="settings-choice-icon"><Icon icon="solar:moon-bold-duotone" width={16} height={16} /></span><strong>{t("colorDark")}</strong></> }]} />
    </section>
    <section className="settings-card"><header className="settings-card-head"><span className="settings-card-title"><Icon icon="solar:pallete-2-bold-duotone" width={16} height={16} /><strong>{t("settingsAccent")}</strong></span></header>
      <SettingsChoiceGroup label={t("settingsAccent")} value={themeSettings.accentColor} className="settings-accent-row" optionClassName="settings-accent-swatch" onChange={(accentColor) => setThemeSettings(updateThemeSettings({ accentColor }))} options={ACCENT_COLORS.map((color) => { const labelKey = `accent${color[0].toUpperCase()}${color.slice(1)}` as TranslationKey; return { value: color, label: t(labelKey), style: { background: `oklch(0.62 ${ACCENT_CHROMA[color]} ${ACCENT_HUES[color]})` }, content: <span className="settings-visually-hidden">{t(labelKey)}</span> }; })} />
    </section>
    <section className="settings-card"><header className="settings-card-head"><span className="settings-card-title"><Icon icon="solar:slider-minimalistic-horizontal-bold-duotone" width={16} height={16} /><strong>{t("settingsDensity")}</strong></span></header>
      <SettingsChoiceGroup label={t("settingsDensity")} value={themeSettings.density} onChange={(density) => setThemeSettings(updateThemeSettings({ density }))} options={[{ value: "cozy", label: t("densityCozy"), content: <><span className="settings-choice-icon"><Icon icon="solar:widget-bold-duotone" width={16} height={16} /></span><strong>{t("densityCozy")}</strong></> }, { value: "compact", label: t("densityCompact"), content: <><span className="settings-choice-icon"><Icon icon="solar:slider-minimalistic-horizontal-bold-duotone" width={16} height={16} /></span><strong>{t("densityCompact")}</strong></> }]} />
    </section>
    <section className="settings-card"><header className="settings-card-head"><span className="settings-card-title"><Icon icon="solar:gallery-bold-duotone" width={16} height={16} /><strong>{t("settingsWallpaper")}</strong></span><div className="settings-card-actions"><button type="button" className="settings-btn-pill" disabled={wallpaperBusy !== null} onClick={syncWallpapers}>{t("settingsWallpaperSync")}</button><button type="button" className="settings-btn-pill" disabled={wallpaperBusy !== null} onClick={() => randomizeWallpaper("light")}>{t("settingsWallpaperRandom")}</button><button type="button" className="settings-btn-pill" disabled={wallpaperBusy !== null} onClick={() => randomizeWallpaper("dark")}>{t("settingsWallpaperRandomDark")}</button></div></header>
      {["light", "dark"].map((target) => <fieldset key={target} className="settings-subsection wallpaper-mode-section settings-choice-fieldset"><legend className="settings-group-legend">{t(target === "light" ? "settingsWallpaperLight" : "settingsWallpaperDark")}</legend>{Object.entries(wallpaperGroups).map(([categoryKey, entries]) => <section key={`${target}-${categoryKey}`} className="wallpaper-group"><h4>{t(categoryKey as TranslationKey)}</h4><div className="wallpaper-grid">{entries.map(([id, wallpaper]) => { const active = target === "light" ? themeSettings.wallpaperLightId : themeSettings.wallpaperDarkId; return <label key={`${target}-${id}`} className={clsx("wallpaper-option", active === id && "is-active")} style={wallpaper.url ? { backgroundImage: `linear-gradient(180deg, oklch(0 0 0 / 0.08), oklch(0 0 0 / 0.44)), url("${wallpaper.url}")` } : undefined}><input type="radio" name={`settings-wallpaper-${target}`} value={id} checked={active === id} disabled={wallpaperBusy !== null} onChange={() => setWallpaper(target as "light" | "dark", id)} /><span>{t(wallpaper.labelKey)}</span></label>; })}</div></section>)}</fieldset>)}
      <div className="settings-split-row"><div><h4>{t("wallpaperFit")}</h4><SettingsChoiceGroup label={t("wallpaperFit")} value={themeSettings.wallpaperFit} className="settings-select-group" optionClassName="settings-btn-pill" onChange={(wallpaperFit) => setThemeSettings(updateThemeSettings({ wallpaperFit }))} options={(["cover", "contain", "stretch", "tile"] as const).map((fit) => ({ value: fit, label: t(fit === "cover" ? "wallpaperFitCover" : fit === "contain" ? "wallpaperFitContain" : fit === "stretch" ? "wallpaperFitStretch" : "wallpaperFitTile") }))} /></div><div><h4>{t("settingsWallpaperOverlay")}</h4><SettingsChoiceGroup label={t("settingsWallpaperOverlay")} value={themeSettings.wallpaperOverlay} className="settings-select-group" optionClassName="settings-btn-pill" onChange={(wallpaperOverlay) => setThemeSettings(updateThemeSettings({ wallpaperOverlay }))} options={(["off", "soft", "standard"] as const).map((overlay) => ({ value: overlay, label: t(overlay === "off" ? "wallpaperOverlayOff" : overlay === "soft" ? "wallpaperOverlaySoft" : "wallpaperOverlayStandard") }))} /></div></div>
    </section>
  </div>;
}
