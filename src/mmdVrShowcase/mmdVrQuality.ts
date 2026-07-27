import {
  applyCommonQualityAxes,
  formatDprLabel,
  formatFrameRateLabel,
  formatOnOff,
  type ImmersiveAntialiasPref,
  type ImmersiveDprPref,
  type ImmersiveFrameRatePref,
  type ImmersiveFramebufferScalePref,
  type ImmersiveFoveationPref,
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
  framebufferScale: number;
  foveation: number;
  shadowMapSize: number;
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
    framebufferScale: 1,
    foveation: 0.25,
    shadowMapSize: 2048,
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
    framebufferScale: 0.85,
    foveation: 0.5,
    shadowMapSize: 1024,
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
    framebufferScale: 0.7,
    foveation: 1,
    shadowMapSize: 512,
  },
};

const WALK_MAP = {
  slow: 0.85,
  normal: 1.15,
  fast: 1.55,
} as const;

const SHADOW_MAP_SIZE = { low: 512, medium: 1024, high: 2048 } as const;

export type MmdVrQualityInput = Pick<
  MmdVrPrefs,
  | "renderQuality"
  | "dprPref"
  | "frameRatePref"
  | "antialiasPref"
  | "shadowsPref"
  | "gridPref"
  | "walkSpeedPref"
  | "framebufferScalePref"
  | "foveationPref"
  | "shadowResolutionPref"
>;

export function getMmdVrRenderProfile(
  qualityOrPrefs: MmdVrRenderQuality | MmdVrQualityInput,
): MmdVrRenderProfile {
  const quality =
    typeof qualityOrPrefs === "string" ? qualityOrPrefs : qualityOrPrefs.renderQuality;
  let base = { ...(PROFILES[quality] ?? PROFILES.balanced) };

  if (typeof qualityOrPrefs === "string") return base;

  const { dprPref, frameRatePref, antialiasPref, shadowsPref, gridPref, walkSpeedPref, framebufferScalePref, foveationPref, shadowResolutionPref } =
    qualityOrPrefs;

  base = applyCommonQualityAxes(base, {
    dprPref: dprPref as ImmersiveDprPref,
    frameRatePref: frameRatePref as ImmersiveFrameRatePref,
    antialiasPref: antialiasPref as ImmersiveAntialiasPref,
    framebufferScalePref: framebufferScalePref as ImmersiveFramebufferScalePref,
    foveationPref: foveationPref as ImmersiveFoveationPref,
  });

  if (shadowsPref === "on") base.shadows = true;
  if (shadowsPref === "off") base.shadows = false;
  if (gridPref === "on") base.showGrid = true;
  if (gridPref === "off") base.showGrid = false;
  if (walkSpeedPref && walkSpeedPref !== "auto") {
    base.walkSpeed = WALK_MAP[walkSpeedPref] ?? base.walkSpeed;
  }
  if (shadowResolutionPref && shadowResolutionPref !== "auto") {
    base.shadowMapSize = SHADOW_MAP_SIZE[shadowResolutionPref] ?? base.shadowMapSize;
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
