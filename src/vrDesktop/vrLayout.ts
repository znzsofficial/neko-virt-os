/** Canonical panel poses (meters, Euler XYZ). Grab-move offsets can layer later. */
export type VrPanelPose = {
  position: [number, number, number];
  rotation: [number, number, number];
};

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
} as const;

export type VrLayoutKey = keyof typeof VR_DEFAULT_LAYOUT;
