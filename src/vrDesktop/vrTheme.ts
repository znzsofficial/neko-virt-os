/**
 * VR canvas / mesh colors — quiet dark OS shell.
 * sRGB hex for Canvas2D + THREE (Quest-safe).
 */
export const vrTheme = {
  bg: "#141820",
  bgDeep: "#0e1118",
  panel: "#1c2330",
  panelHover: "#252e40",
  elevated: "#222a38",
  border: "#2f3a4d",
  borderStrong: "#3d4a62",
  ink: "#f0f3f8",
  muted: "#a8b4c8",
  subtle: "#6f7d94",
  primary: "#5b8af5",
  primaryInk: "#f7f9fc",
  primarySoft: "#1a2740",
  /** Exit is secondary — not a billboard accent */
  exitFill: "#1a2030",
  exitBorder: "#3a4860",
  exitInk: "#dce4f0",
  stageBg: "#080a0f",
  floor: "#10141c",
  floorRing: "#1a2030",
  frame: "#0c0f14",
  frameEdge: "#243044",
  fog: "#080a0f",
  pillBg: "#1a2334",
  pillBorder: "#354560",
  radius: 14,
  gap: 14,
  cellMinH: 88,
  panelDepth: 0.018,
  panelBezel: 0.02,
} as const;

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
