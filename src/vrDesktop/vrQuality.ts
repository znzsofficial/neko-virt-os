import {
  applyCommonQualityAxes,
  formatDprLabel,
  formatFrameRateLabel,
  formatOnOff,
  scalePanelSize,
  type ImmersiveAntialiasPref,
  type ImmersiveDprPref,
  type ImmersiveFrameRatePref,
  type ImmersiveRenderQuality,
} from "../xr";
import type {
  VrAntialiasPref,
  VrDprPref,
  VrFrameRatePref,
  VrPanelScalePref,
  VrRenderQuality,
  VrDesktopPrefs,
} from "./vrDesktopStore";

export { scalePanelSize };

/** Base panel canvas sizes before quality scale. */
export const VR_PANEL_BASE = {
  home: { w: 1024, h: 640 },
  launch: { w: 960, h: 720 },
  sticky: { w: 720, h: 560 },
  exit: { w: 420, h: 96 },
} as const;

export type VrRenderProfile = {
  quality: VrRenderQuality;
  /** R3F Canvas dpr */
  dpr: number | [number, number];
  antialias: boolean;
  /** Multiply base panel pixel sizes (then floor to even ints). */
  panelScale: number;
  floorSegments: number;
  /** XR target frame rate hint for @pmndrs/xr */
  frameRate: "high" | "mid" | "low" | false;
  /** Soft-edge vignette allowed (still gated by prefs.softEdges). */
  allowSoftEdges: boolean;
};

const PROFILES: Record<VrRenderQuality, VrRenderProfile> = {
  high: {
    quality: "high",
    dpr: [1, 1.35],
    antialias: true,
    panelScale: 1,
    floorSegments: 48,
    frameRate: "high",
    allowSoftEdges: true,
  },
  balanced: {
    quality: "balanced",
    dpr: 1,
    antialias: false,
    panelScale: 0.75,
    floorSegments: 32,
    frameRate: "mid",
    allowSoftEdges: true,
  },
  low: {
    quality: "low",
    dpr: 1,
    antialias: false,
    panelScale: 0.55,
    floorSegments: 24,
    frameRate: "low",
    allowSoftEdges: false,
  },
};

const PANEL_SCALE_MAP: Record<Exclude<VrPanelScalePref, "auto">, number> = {
  low: 0.55,
  medium: 0.75,
  high: 1,
};

export type VrQualityInput = Pick<
  VrDesktopPrefs,
  "renderQuality" | "dprPref" | "panelScalePref" | "frameRatePref" | "antialiasPref"
>;

export function getVrRenderProfile(
  qualityOrPrefs: VrRenderQuality | VrQualityInput,
): VrRenderProfile {
  const quality =
    typeof qualityOrPrefs === "string" ? qualityOrPrefs : qualityOrPrefs.renderQuality;
  let base = { ...(PROFILES[quality] ?? PROFILES.balanced) };

  if (typeof qualityOrPrefs === "string") return base;

  const { dprPref, panelScalePref, frameRatePref, antialiasPref } = qualityOrPrefs;

  base = applyCommonQualityAxes(base, {
    dprPref: dprPref as ImmersiveDprPref,
    frameRatePref: frameRatePref as ImmersiveFrameRatePref,
    antialiasPref: antialiasPref as ImmersiveAntialiasPref,
  });

  if (panelScalePref && panelScalePref !== "auto") {
    base.panelScale = PANEL_SCALE_MAP[panelScalePref] ?? base.panelScale;
  }

  return base;
}

export function formatVrProfileSummary(
  profile: VrRenderProfile,
  language: "zh" | "en",
): string {
  const dpr = formatDprLabel(profile.dpr);
  const aa = formatOnOff(profile.antialias, language);
  const fps = formatFrameRateLabel(profile.frameRate);
  if (language === "zh") {
    return `DPR ${dpr} · AA ${aa} · 面板 ${Math.round(profile.panelScale * 100)}% · 目标 ${fps}`;
  }
  return `DPR ${dpr} · AA ${aa} · panels ${Math.round(profile.panelScale * 100)}% · target ${fps}`;
}

// Re-export quality alias types for convenience (same as store).
export type { ImmersiveRenderQuality as SharedRenderQuality };
