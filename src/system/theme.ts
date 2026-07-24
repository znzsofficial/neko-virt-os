import type { TranslationKey } from "../languageStore";
import type { ThemeSettings } from "../types";

export const THEME_STORAGE_KEY = "neko-virt-os.theme-settings.v1";

export const WALLPAPERS: Record<ThemeSettings["wallpaperId"], { labelKey: TranslationKey; categoryKey: TranslationKey; source: "built-in" | "unsplash"; url?: string }> = {
  system: { labelKey: "wallpaperSystem", categoryKey: "wallpaperCategoryBuiltIn", source: "built-in" },
  "alpine-lake": { labelKey: "wallpaperAlpineLake", categoryKey: "wallpaperCategoryNature", source: "unsplash", url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=2400&q=85" },
  "star-field": { labelKey: "wallpaperStarField", categoryKey: "wallpaperCategorySky", source: "unsplash", url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=2400&q=85" },
  pacific: { labelKey: "wallpaperPacific", categoryKey: "wallpaperCategoryNature", source: "unsplash", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2400&q=85" },
  "green-meadow": { labelKey: "wallpaperGreenMeadow", categoryKey: "wallpaperCategoryNature", source: "unsplash", url: "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=2400&q=85" },
  forest: { labelKey: "wallpaperForest", categoryKey: "wallpaperCategoryNature", source: "unsplash", url: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=2400&q=85" },
  cabin: { labelKey: "wallpaperCabin", categoryKey: "wallpaperCategoryNature", source: "unsplash", url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=85" },
  "desert-dunes": { labelKey: "wallpaperDesertDunes", categoryKey: "wallpaperCategoryNature", source: "unsplash", url: "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=2400&q=85" },
  "aurora-sky": { labelKey: "wallpaperAuroraSky", categoryKey: "wallpaperCategorySky", source: "unsplash", url: "https://images.unsplash.com/photo-1483347756197-71ef80e95f73?auto=format&fit=crop&w=2400&q=85" },
  "snow-peak": { labelKey: "wallpaperSnowPeak", categoryKey: "wallpaperCategoryNature", source: "unsplash", url: "https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=2400&q=85" },
  "city-lights": { labelKey: "wallpaperCityLights", categoryKey: "wallpaperCategoryCity", source: "unsplash", url: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=2400&q=85" },
  "sunset-coast": { labelKey: "wallpaperSunsetCoast", categoryKey: "wallpaperCategoryNature", source: "unsplash", url: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=2400&q=85" },
  "misty-forest": { labelKey: "wallpaperMistyForest", categoryKey: "wallpaperCategoryNature", source: "unsplash", url: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=2400&q=85" },
  "granite-lake": { labelKey: "wallpaperGraniteLake", categoryKey: "wallpaperCategoryNature", source: "unsplash", url: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=2400&q=85" },
  "glass-towers": { labelKey: "wallpaperGlassTowers", categoryKey: "wallpaperCategoryCity", source: "unsplash", url: "https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=2400&q=85" },
  "neon-street": { labelKey: "wallpaperNeonStreet", categoryKey: "wallpaperCategoryCity", source: "unsplash", url: "https://images.unsplash.com/photo-1520034475321-cbe63696469a?auto=format&fit=crop&w=2400&q=85" },
};

export const DEFAULT_THEME_SETTINGS: ThemeSettings = { accentColor: "blue", density: "cozy", theme: "system", wallpaperId: "system", wallpaperLightId: "system", wallpaperDarkId: "system", wallpaperFit: "cover", wallpaperOverlay: "standard" };

export const ACCENT_COLORS = [
  "blue",
  "cyan",
  "emerald",
  "mint",
  "amber",
  "coral",
  "rose",
  "purple",
  "violet",
  "slate",
] as const satisfies readonly ThemeSettings["accentColor"][];

export const ACCENT_HUES: Record<ThemeSettings["accentColor"], string> = {
  blue: "250",
  cyan: "210",
  emerald: "150",
  mint: "170",
  amber: "75",
  coral: "35",
  rose: "10",
  purple: "300",
  violet: "285",
  slate: "250",
};

export const ACCENT_CHROMA: Record<ThemeSettings["accentColor"], string> = {
  blue: "0.145",
  cyan: "0.12",
  emerald: "0.14",
  mint: "0.11",
  amber: "0.13",
  coral: "0.14",
  rose: "0.15",
  purple: "0.16",
  violet: "0.14",
  slate: "0.04",
};

const WALLPAPER_FITS: ThemeSettings["wallpaperFit"][] = ["cover", "contain", "stretch", "tile"];

export function normalizeThemeSettings(value: Partial<ThemeSettings> & { accentColor?: string } = {}): ThemeSettings {
  const accentColor = (ACCENT_COLORS as readonly string[]).includes(value.accentColor as string)
    ? (value.accentColor as ThemeSettings["accentColor"])
    : DEFAULT_THEME_SETTINGS.accentColor;

  return {
    accentColor,
    density: value.density === "compact" || value.density === "cozy" ? value.density : DEFAULT_THEME_SETTINGS.density,
    theme: value.theme === "system" || value.theme === "dark" || value.theme === "light" ? value.theme : DEFAULT_THEME_SETTINGS.theme,
    wallpaperId: value.wallpaperId && value.wallpaperId in WALLPAPERS ? value.wallpaperId as ThemeSettings["wallpaperId"] : DEFAULT_THEME_SETTINGS.wallpaperId,
    wallpaperLightId:
      value.wallpaperLightId && value.wallpaperLightId in WALLPAPERS
        ? value.wallpaperLightId as ThemeSettings["wallpaperLightId"]
        : value.wallpaperId && value.wallpaperId in WALLPAPERS
          ? value.wallpaperId as ThemeSettings["wallpaperLightId"]
          : DEFAULT_THEME_SETTINGS.wallpaperLightId,
    wallpaperDarkId:
      value.wallpaperDarkId && value.wallpaperDarkId in WALLPAPERS
        ? value.wallpaperDarkId as ThemeSettings["wallpaperDarkId"]
        : value.wallpaperId && value.wallpaperId in WALLPAPERS
          ? value.wallpaperId as ThemeSettings["wallpaperDarkId"]
          : DEFAULT_THEME_SETTINGS.wallpaperDarkId,
    wallpaperFit: WALLPAPER_FITS.includes(value.wallpaperFit as ThemeSettings["wallpaperFit"]) ? value.wallpaperFit as ThemeSettings["wallpaperFit"] : DEFAULT_THEME_SETTINGS.wallpaperFit,
    wallpaperOverlay:
      value.wallpaperOverlay === "off" || value.wallpaperOverlay === "soft" || value.wallpaperOverlay === "standard"
        ? value.wallpaperOverlay
        : typeof value.wallpaperOverlay === "boolean"
          ? value.wallpaperOverlay ? "standard" : "off"
          : DEFAULT_THEME_SETTINGS.wallpaperOverlay,
  };
}

export function readThemeSettings(): ThemeSettings {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return raw ? normalizeThemeSettings(JSON.parse(raw)) : DEFAULT_THEME_SETTINGS;
  } catch {
    return DEFAULT_THEME_SETTINGS;
  }
}

/** Merge patch, persist, and apply to the document. */
export function updateThemeSettings(patch: Partial<ThemeSettings>): ThemeSettings {
  const next = normalizeThemeSettings({ ...readThemeSettings(), ...patch });
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota
  }
  applyThemeSettings(next);
  return next;
}

export function applyThemeSettings(theme: ThemeSettings) {
  const root = document.documentElement;
  const effectiveTheme = resolveThemeMode(theme.theme);
  const hue = ACCENT_HUES[theme.accentColor] ?? ACCENT_HUES.blue;
  const chroma = ACCENT_CHROMA[theme.accentColor] ?? ACCENT_CHROMA.blue;
  const primaryL = effectiveTheme === "dark" ? "0.72" : "0.52";
  const primaryStrongL = effectiveTheme === "dark" ? "0.64" : "0.45";
  const accentL = effectiveTheme === "dark" ? "0.78" : "0.65";
  const softBg =
    effectiveTheme === "dark"
      ? `oklch(0.26 ${Math.min(0.08, Number(chroma))} ${hue})`
      : `oklch(0.94 ${Math.min(0.04, Number(chroma) * 0.25)} ${hue})`;

  root.setAttribute("data-accent", theme.accentColor);
  root.setAttribute("data-density", theme.density);
  root.setAttribute("data-theme-mode", theme.theme);
  root.setAttribute("data-theme", effectiveTheme);

  // Inline tokens so accent changes always recompute (attribute-only CSS can look like a no-op).
  root.style.setProperty("--os-primary-color", hue);
  root.style.setProperty("--os-primary-chroma", chroma);
  root.style.setProperty("--os-primary", `oklch(${primaryL} ${chroma} ${hue})`);
  root.style.setProperty("--os-primary-strong", `oklch(${primaryStrongL} ${chroma} ${hue})`);
  root.style.setProperty("--os-primary-soft", softBg);
  root.style.setProperty("--os-accent", `oklch(${accentL} ${chroma} ${hue})`);
  root.style.setProperty("--os-accent-soft", softBg);
  root.style.setProperty("--os-focus", `oklch(${accentL} ${chroma} ${hue})`);
  root.style.setProperty("--os-focus-ring", `oklch(${accentL} ${chroma} ${hue} / 0.28)`);
  root.style.setProperty(
    "--os-selection",
    effectiveTheme === "dark"
      ? `oklch(0.29 ${Math.min(0.08, Number(chroma))} ${hue} / 0.72)`
      : `oklch(0.98 ${Math.min(0.04, Number(chroma) * 0.2)} ${hue} / 0.78)`,
  );
  root.style.setProperty(
    "--os-selection-border",
    effectiveTheme === "dark" ? `oklch(0.57 ${chroma} ${hue})` : `oklch(0.78 ${Math.min(0.08, Number(chroma))} ${hue})`,
  );
  root.style.setProperty(
    "--os-wallpaper-glow-a",
    effectiveTheme === "dark"
      ? `oklch(0.3 ${Math.min(0.08, Number(chroma))} ${hue} / 0.24)`
      : `oklch(0.93 ${Math.min(0.04, Number(chroma) * 0.2)} ${hue} / 0.24)`,
  );

  // Drive native chrome (scrollbars, form controls) with the resolved theme.
  root.style.colorScheme = effectiveTheme;
  const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
  if (colorSchemeMeta) colorSchemeMeta.setAttribute("content", effectiveTheme);
  const wallpaper = WALLPAPERS[effectiveTheme === "dark" ? theme.wallpaperDarkId : theme.wallpaperLightId];
  root.style.setProperty("--os-wallpaper-image", wallpaper.url ? `url("${wallpaper.url}")` : "none");
  root.style.setProperty("--os-wallpaper-size", getWallpaperSize(theme.wallpaperFit));
  root.style.setProperty("--os-wallpaper-repeat", theme.wallpaperFit === "tile" ? "repeat" : "no-repeat");
  root.setAttribute("data-wallpaper", wallpaper.url ? "online" : "system");
  root.setAttribute("data-wallpaper-fit", theme.wallpaperFit);
  root.setAttribute("data-wallpaper-overlay", theme.wallpaperOverlay);
}

function getWallpaperSize(fit: ThemeSettings["wallpaperFit"]) {
  if (fit === "contain") return "contain";
  if (fit === "stretch") return "100% 100%";
  if (fit === "tile") return "auto";
  return "cover";
}

export function resolveThemeMode(theme: ThemeSettings["theme"]): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
