/** Shared immersive quality axes (desktop + MMD). Product-specific knobs stay local. */

export type ImmersiveRenderQuality = "high" | "balanced" | "low";
export type ImmersiveDprPref = "auto" | "1" | "1.25" | "1.5";
export type ImmersiveFrameRatePref = "auto" | "high" | "mid" | "low";
export type ImmersiveAntialiasPref = "auto" | "on" | "off";
export type ImmersiveTogglePref = "auto" | "on" | "off";
export type ImmersiveFrameRate = "high" | "mid" | "low" | false;

export const IMMERSIVE_DPR_MAP: Record<
  Exclude<ImmersiveDprPref, "auto">,
  number | [number, number]
> = {
  "1": 1,
  "1.25": [1, 1.25],
  "1.5": [1, 1.5],
};

export type CommonQualityAxes = {
  dpr: number | [number, number];
  antialias: boolean;
  frameRate: ImmersiveFrameRate;
};

export type CommonQualityPrefs = {
  dprPref?: ImmersiveDprPref;
  frameRatePref?: ImmersiveFrameRatePref;
  antialiasPref?: ImmersiveAntialiasPref;
};

/** Mutates a copy of base with shared axis overrides. */
export function applyCommonQualityAxes<T extends CommonQualityAxes>(
  base: T,
  prefs: CommonQualityPrefs,
): T {
  const next = { ...base };
  if (prefs.dprPref && prefs.dprPref !== "auto") {
    next.dpr = IMMERSIVE_DPR_MAP[prefs.dprPref] ?? next.dpr;
  }
  if (prefs.frameRatePref && prefs.frameRatePref !== "auto") {
    next.frameRate = prefs.frameRatePref;
  }
  if (prefs.antialiasPref === "on") next.antialias = true;
  if (prefs.antialiasPref === "off") next.antialias = false;
  return next;
}

export function formatDprLabel(dpr: number | [number, number]): string {
  return typeof dpr === "number" ? String(dpr) : `${dpr[0]}–${dpr[1]}`;
}

export function formatFrameRateLabel(frameRate: ImmersiveFrameRate): string {
  if (frameRate === false) return "—";
  if (frameRate === "high") return "72+";
  if (frameRate === "mid") return "~60";
  return "~45";
}

export function formatOnOff(on: boolean, language: "zh" | "en"): string {
  if (language === "zh") return on ? "开" : "关";
  return on ? "on" : "off";
}

export function scalePanelSize(base: number, scale: number): number {
  const n = Math.max(64, Math.round(base * scale));
  return n % 2 === 0 ? n : n + 1;
}

export function normalizeImmersiveQuality(value: unknown): ImmersiveRenderQuality {
  if (value === "high" || value === "balanced" || value === "low") return value;
  return "balanced";
}

export function normalizeImmersiveDpr(value: unknown): ImmersiveDprPref {
  if (value === "auto" || value === "1" || value === "1.25" || value === "1.5") return value;
  return "auto";
}

export function normalizeImmersiveFrameRate(value: unknown): ImmersiveFrameRatePref {
  if (value === "auto" || value === "high" || value === "mid" || value === "low") return value;
  return "auto";
}

export function normalizeImmersiveAntialias(value: unknown): ImmersiveAntialiasPref {
  if (value === "auto" || value === "on" || value === "off") return value;
  return "auto";
}

export function normalizeImmersiveToggle(value: unknown): ImmersiveTogglePref {
  if (value === "auto" || value === "on" || value === "off") return value;
  return "auto";
}
