import type { TranslationKey } from "./languageStore";
import type { ThemeSettings } from "./types";

export const THEME_STORAGE_KEY = "neko-virt-os.theme-settings.v1";

export const WALLPAPERS: Record<ThemeSettings["wallpaperId"], { labelKey: TranslationKey; source: "built-in" | "unsplash"; url?: string }> = {
  system: { labelKey: "wallpaperSystem", source: "built-in" },
  "alpine-lake": { labelKey: "wallpaperAlpineLake", source: "unsplash", url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=2400&q=85" },
  "star-field": { labelKey: "wallpaperStarField", source: "unsplash", url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=2400&q=85" },
  pacific: { labelKey: "wallpaperPacific", source: "unsplash", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2400&q=85" },
  "green-meadow": { labelKey: "wallpaperGreenMeadow", source: "unsplash", url: "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=2400&q=85" },
  forest: { labelKey: "wallpaperForest", source: "unsplash", url: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=2400&q=85" },
  cabin: { labelKey: "wallpaperCabin", source: "unsplash", url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=85" },
};

export const DEFAULT_THEME_SETTINGS: ThemeSettings = { accentColor: "blue", density: "cozy", theme: "system", wallpaperId: "system", wallpaperFit: "cover" };

export const ACCENT_HUES: Record<ThemeSettings["accentColor"], string> = {
  blue: "250",
  purple: "300",
  emerald: "150",
  amber: "75",
};

const WALLPAPER_FITS: ThemeSettings["wallpaperFit"][] = ["cover", "contain", "stretch", "tile"];

export function normalizeThemeSettings(value: Partial<ThemeSettings> & { accentColor?: string } = {}): ThemeSettings {
  const accentColor = (["blue", "purple", "emerald", "amber"] as const).includes(value.accentColor as ThemeSettings["accentColor"])
    ? (value.accentColor as ThemeSettings["accentColor"])
    : DEFAULT_THEME_SETTINGS.accentColor;

  return {
    accentColor,
    density: value.density === "compact" || value.density === "cozy" ? value.density : DEFAULT_THEME_SETTINGS.density,
    theme: value.theme === "system" || value.theme === "dark" || value.theme === "light" ? value.theme : DEFAULT_THEME_SETTINGS.theme,
    wallpaperId: value.wallpaperId && value.wallpaperId in WALLPAPERS ? value.wallpaperId as ThemeSettings["wallpaperId"] : DEFAULT_THEME_SETTINGS.wallpaperId,
    wallpaperFit: WALLPAPER_FITS.includes(value.wallpaperFit as ThemeSettings["wallpaperFit"]) ? value.wallpaperFit as ThemeSettings["wallpaperFit"] : DEFAULT_THEME_SETTINGS.wallpaperFit,
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

export function applyThemeSettings(theme: ThemeSettings) {
  const root = document.documentElement;
  root.setAttribute("data-accent", theme.accentColor);
  root.setAttribute("data-density", theme.density);
  root.setAttribute("data-theme-mode", theme.theme);
  root.setAttribute("data-theme", resolveThemeMode(theme.theme));
  const wallpaper = WALLPAPERS[theme.wallpaperId];
  root.style.setProperty("--os-wallpaper-image", wallpaper.url ? `url("${wallpaper.url}")` : "none");
  root.style.setProperty("--os-wallpaper-size", getWallpaperSize(theme.wallpaperFit));
  root.style.setProperty("--os-wallpaper-repeat", theme.wallpaperFit === "tile" ? "repeat" : "no-repeat");
  root.setAttribute("data-wallpaper", wallpaper.url ? "online" : "system");
  root.setAttribute("data-wallpaper-fit", theme.wallpaperFit);
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
