export const XR_THEME_COLORS = ["blue", "cyan", "purple", "green", "red"] as const;
export type XrThemeColor = (typeof XR_THEME_COLORS)[number];

export type XrAccentTokens = {
  primary: string;
  soft: string;
  border: string;
  marker: string;
  gridMajor: string;
  gridMinor: string;
};

const PALETTES: Record<XrThemeColor, XrAccentTokens> = {
  blue: { primary: "#5b8def", soft: "#1d2c4b", border: "#496ca8", marker: "#72a7ff", gridMajor: "#365584", gridMinor: "#243956" },
  cyan: { primary: "#36a9bf", soft: "#173b43", border: "#347987", marker: "#57c9dc", gridMajor: "#2d6470", gridMinor: "#21434a" },
  purple: { primary: "#9270df", soft: "#30244d", border: "#6c58a0", marker: "#ad8cf2", gridMajor: "#57477d", gridMinor: "#393052" },
  green: { primary: "#4fa77d", soft: "#1d3b2f", border: "#3f775e", marker: "#6cc69a", gridMajor: "#37634f", gridMinor: "#274437" },
  red: { primary: "#c35d70", soft: "#3a2028", border: "#80505e", marker: "#df788b", gridMajor: "#633945", gridMinor: "#432a31" },
};

export function normalizeXrThemeColor(value: unknown): XrThemeColor {
  return XR_THEME_COLORS.includes(value as XrThemeColor) ? value as XrThemeColor : "blue";
}

export function getXrAccentTokens(value: unknown): XrAccentTokens {
  return PALETTES[normalizeXrThemeColor(value)];
}

export function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const n = Number.parseInt(value, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
