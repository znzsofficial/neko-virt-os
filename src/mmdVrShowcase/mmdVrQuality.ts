import {
  applyCommonQualityAxes,
  formatDprLabel,
  formatFrameRateLabel,
  formatOnOff,
  type ImmersiveAntialiasPref,
  type ImmersiveDprPref,
  type ImmersiveFrameRatePref,
} from "../xr";
import type { MmdVrPrefs, MmdVrRenderQuality } from "./mmdVrStore";

export type { MmdVrRenderQuality };

export type MmdVrRenderProfile = {
  quality: MmdVrRenderQuality;
  dpr: number | [number, number];
  antialias: boolean;
  floorSegments: number;
  frameRate: "high" | "mid" | "low" | false;
  shadows: boolean;
  showGrid: boolean;
  walkSpeed: number;
};

const PROFILES: Record<MmdVrRenderQuality, MmdVrRenderProfile> = {
  high: {
    quality: "high",
    dpr: [1, 1.25],
    antialias: true,
    floorSegments: 48,
    frameRate: "high",
    shadows: true,
    showGrid: true,
    walkSpeed: 1.35,
  },
  balanced: {
    quality: "balanced",
    dpr: 1,
    antialias: false,
    floorSegments: 32,
    frameRate: "mid",
    shadows: false,
    showGrid: true,
    walkSpeed: 1.15,
  },
  low: {
    quality: "low",
    dpr: 1,
    antialias: false,
    floorSegments: 20,
    frameRate: "low",
    shadows: false,
    showGrid: false,
    walkSpeed: 1.0,
  },
};

const WALK_MAP = {
  slow: 0.85,
  normal: 1.15,
  fast: 1.55,
} as const;

export type MmdVrQualityInput = Pick<
  MmdVrPrefs,
  | "renderQuality"
  | "dprPref"
  | "frameRatePref"
  | "antialiasPref"
  | "shadowsPref"
  | "gridPref"
  | "walkSpeedPref"
>;

export function getMmdVrRenderProfile(
  qualityOrPrefs: MmdVrRenderQuality | MmdVrQualityInput,
): MmdVrRenderProfile {
  const quality =
    typeof qualityOrPrefs === "string" ? qualityOrPrefs : qualityOrPrefs.renderQuality;
  let base = { ...(PROFILES[quality] ?? PROFILES.balanced) };

  if (typeof qualityOrPrefs === "string") return base;

  const { dprPref, frameRatePref, antialiasPref, shadowsPref, gridPref, walkSpeedPref } =
    qualityOrPrefs;

  base = applyCommonQualityAxes(base, {
    dprPref: dprPref as ImmersiveDprPref,
    frameRatePref: frameRatePref as ImmersiveFrameRatePref,
    antialiasPref: antialiasPref as ImmersiveAntialiasPref,
  });

  if (shadowsPref === "on") base.shadows = true;
  if (shadowsPref === "off") base.shadows = false;
  if (gridPref === "on") base.showGrid = true;
  if (gridPref === "off") base.showGrid = false;
  if (walkSpeedPref && walkSpeedPref !== "auto") {
    base.walkSpeed = WALK_MAP[walkSpeedPref] ?? base.walkSpeed;
  }

  return base;
}

export function formatMmdVrProfileSummary(
  profile: MmdVrRenderProfile,
  language: "zh" | "en",
): string {
  const dpr = formatDprLabel(profile.dpr);
  const aa = formatOnOff(profile.antialias, language);
  const sh = formatOnOff(profile.shadows, language);
  const gr = formatOnOff(profile.showGrid, language);
  const fps = formatFrameRateLabel(profile.frameRate);
  if (language === "zh") {
    return `DPR ${dpr} · AA ${aa} · 阴影 ${sh} · 网格 ${gr} · 走速 ${profile.walkSpeed.toFixed(2)} · 目标 ${fps}`;
  }
  return `DPR ${dpr} · AA ${aa} · shadows ${sh} · grid ${gr} · walk ${profile.walkSpeed.toFixed(2)} · target ${fps}`;
}
