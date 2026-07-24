/** Canonical panel poses (meters, Euler XYZ). */

export type VrPanelPose = {
  position: [number, number, number];
  rotation: [number, number, number];
};

export type VrPanelSize = { w: number; h: number };

/** Panels the user can drag in VR. */
export type VrMovablePanelId = "home" | "launch" | "sticky" | "browser";

/** World-space plane sizes (meters). */
export const VR_PANEL_SIZE = {
  home: { w: 2.2, h: 1.375 },
  launch: { w: 1.9, h: 1.425 },
  sticky: { w: 1.35, h: 1.05 },
  browser: { w: 2.4, h: 1.55 },
  secondaryBtn: [0.72, 0.165] as [number, number],
  resetBtn: [0.78, 0.165] as [number, number],
} as const;

export const VR_DEFAULT_LAYOUT = {
  home: {
    position: [-1.4, 1.5, -2.2] as [number, number, number],
    rotation: [0, 0.22, 0] as [number, number, number],
  },
  launch: {
    position: [1.35, 1.48, -2.1] as [number, number, number],
    rotation: [0, -0.24, 0] as [number, number, number],
  },
  sticky: {
    position: [0.05, 0.95, -2.55] as [number, number, number],
    rotation: [0.06, 0, 0] as [number, number, number],
  },
  exit: {
    position: [-1.55, 0.58, -1.85] as [number, number, number],
    rotation: [0, 0.18, 0] as [number, number, number],
  },
  reset: {
    position: [-0.7, 0.58, -1.75] as [number, number, number],
    rotation: [0, 0.1, 0] as [number, number, number],
  },
  browser: {
    position: [0, 1.35, -1.85] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
  },
} as const;

export type VrLayoutKey = keyof typeof VR_DEFAULT_LAYOUT;

export const VR_MOVABLE_PANEL_IDS: VrMovablePanelId[] = ["home", "launch", "sticky", "browser"];

export function defaultPose(id: VrMovablePanelId): VrPanelPose {
  const d = VR_DEFAULT_LAYOUT[id];
  return {
    position: [...d.position] as [number, number, number],
    rotation: [...d.rotation] as [number, number, number],
  };
}

export function clonePose(pose: VrPanelPose): VrPanelPose {
  return {
    position: [...pose.position] as [number, number, number],
    rotation: [...pose.rotation] as [number, number, number],
  };
}

/** Soft bounds so panels stay near the work area. */
export function clampPanelPosition(p: [number, number, number]): [number, number, number] {
  return [
    Math.min(3.5, Math.max(-3.5, p[0])),
    Math.min(2.4, Math.max(0.35, p[1])),
    Math.min(-0.6, Math.max(-4.5, p[2])),
  ];
}
