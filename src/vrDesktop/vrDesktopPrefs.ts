import {
  normalizeImmersiveAntialias,
  normalizeImmersiveDpr,
  normalizeImmersiveFrameRate,
  normalizeImmersiveFramebufferScale,
  normalizeImmersiveFoveation,
  normalizeImmersiveQuality,
  type ImmersiveAntialiasPref,
  type ImmersiveDprPref,
  type ImmersiveFrameRatePref,
  type ImmersiveFramebufferScalePref,
  type ImmersiveFoveationPref,
  type ImmersiveRenderQuality,
} from "../xr/qualityAxes";
import { normalizeXrThemeColor, type XrThemeColor } from "../xr/themeColor";

export type VrRenderQuality = ImmersiveRenderQuality;
export type VrDprPref = ImmersiveDprPref;
export type VrPanelScalePref = "auto" | "low" | "medium" | "high";
export type VrFrameRatePref = ImmersiveFrameRatePref;
export type VrAntialiasPref = ImmersiveAntialiasPref;
export type VrFramebufferScalePref = ImmersiveFramebufferScalePref;
export type VrFoveationPref = ImmersiveFoveationPref;
export type VrFloorDetailPref = "auto" | "low" | "medium" | "high";

export type VrDesktopPrefs = {
  enabled: boolean;
  softEdges: boolean;
  renderQuality: VrRenderQuality;
  showFps: boolean;
  dprPref: VrDprPref;
  panelScalePref: VrPanelScalePref;
  frameRatePref: VrFrameRatePref;
  antialiasPref: VrAntialiasPref;
  framebufferScalePref: VrFramebufferScalePref;
  foveationPref: VrFoveationPref;
  floorDetailPref: VrFloorDetailPref;
  themeColor: XrThemeColor;
};

export const VR_DESKTOP_PREFS_KEY = "neko-virt-os.vr-desktop.v2";
export const VR_DESKTOP_PREFS_LEGACY_KEY = "neko-virt-os.vr-desktop.v1";

function normalizePanelScale(value: unknown): VrPanelScalePref {
  if (value === "auto" || value === "low" || value === "medium" || value === "high") return value;
  return "auto";
}

function normalizeFloorDetail(value: unknown): VrFloorDetailPref {
  if (value === "auto" || value === "low" || value === "medium" || value === "high") return value;
  return "auto";
}

export function normalizeVrDesktopPrefs(parsed: Partial<VrDesktopPrefs> = {}): VrDesktopPrefs {
  return {
    enabled: parsed.enabled !== false,
    softEdges: Boolean(parsed.softEdges),
    renderQuality: normalizeImmersiveQuality(parsed.renderQuality),
    showFps: Boolean(parsed.showFps),
    dprPref: normalizeImmersiveDpr(parsed.dprPref),
    panelScalePref: normalizePanelScale(parsed.panelScalePref),
    frameRatePref: normalizeImmersiveFrameRate(parsed.frameRatePref),
    antialiasPref: normalizeImmersiveAntialias(parsed.antialiasPref),
    framebufferScalePref: normalizeImmersiveFramebufferScale(parsed.framebufferScalePref),
    foveationPref: normalizeImmersiveFoveation(parsed.foveationPref),
    floorDetailPref: normalizeFloorDetail(parsed.floorDetailPref),
    themeColor: normalizeXrThemeColor(parsed.themeColor),
  };
}
