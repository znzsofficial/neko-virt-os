import { getXrAccentTokens, normalizeXrThemeColor, type XrThemeColor } from "../xr/themeColor";

/**
 * VR canvas / mesh colors — quiet dark OS shell.
 * sRGB hex for Canvas2D + THREE (Quest-safe).
 */
export const vrTheme = {
  bg: "#181719",
  bgDeep: "#100f11",
  panel: "#242124",
  panelHover: "#30292d",
  elevated: "#2a2629",
  border: "#433b40",
  borderStrong: "#68565e",
  ink: "#f4eff1",
  muted: "#c2b6bb",
  subtle: "#8b7d83",
  primary: "#5b8def",
  primaryInk: "#f7f9fc",
  primarySoft: "#1d2c4b",
  /** Exit is secondary — not a billboard accent */
  exitFill: "#211d20",
  exitBorder: "#51454b",
  exitInk: "#eee6e9",
  stageBg: "#09080a",
  floor: "#121013",
  floorRing: "#365584",
  floorGuide: "#2a2226",
  frame: "#0e0c0e",
  frameEdge: "#496ca8",
  fog: "#09080a",
  pillBg: "#282126",
  pillBorder: "#54444b",
  radius: 14,
  gap: 14,
  cellMinH: 88,
  panelDepth: 0.018,
  panelBezel: 0.02,
};

let currentThemeColor: XrThemeColor = "blue";

export function setVrThemeColor(value: unknown): XrThemeColor {
  currentThemeColor = normalizeXrThemeColor(value);
  const accent = getXrAccentTokens(currentThemeColor);
  vrTheme.primary = accent.primary;
  vrTheme.primarySoft = accent.soft;
  vrTheme.floorRing = accent.gridMajor;
  vrTheme.frameEdge = accent.border;
  return currentThemeColor;
}

/** App tint — soft identity dots only */
export const vrAppTint: Record<string, string> = {
  files: "#6bb8ea",
  notes: "#e0b84a",
  browser: "#4ec4d4",
  calculator: "#c48ae8",
  calendar: "#5ec9a0",
  tasks: "#e07aa8",
  timer: "#e08a5c",
  palette: "#e0b84a",
  "api-tester": "#4ec4d4",
  "qr-tool": "#5ec9a0",
  recorder: "#e07aa8",
  "music-player": "#c48ae8",
  "video-player": "#e08a5c",
  settings: "#9b7aef",
  "task-manager": "#e08a5c",
  about: "#e07aa8",
  "sticky-board": "#e0b84a",
  clipboard: "#5ec9a0",
  terminal: "#5ec98a",
  "mmd-studio": "#c48ae8",
  downloads: "#6bb8ea",
  trash: "#c06050",
};

export function getVrAppTint(appId: string): string {
  return vrAppTint[appId] ?? vrTheme.primary;
}
