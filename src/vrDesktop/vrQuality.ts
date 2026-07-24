import type { VrRenderQuality } from "./vrDesktopStore";

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

export function getVrRenderProfile(quality: VrRenderQuality): VrRenderProfile {
  return PROFILES[quality] ?? PROFILES.balanced;
}

export function scalePanelSize(base: number, scale: number): number {
  const n = Math.max(64, Math.round(base * scale));
  // Even dimensions play nicer with some GPUs.
  return n % 2 === 0 ? n : n + 1;
}
