import { create } from "zustand";
import {
  clampPanelPosition,
  clonePose,
  defaultPose,
  VR_MOVABLE_PANEL_IDS,
  type VrMovablePanelId,
  type VrPanelPose,
} from "./vrLayout";

const LAYOUT_KEY = "neko-virt-os.vr-layout.v1";

type LayoutMap = Record<VrMovablePanelId, VrPanelPose>;

function buildDefaults(): LayoutMap {
  return {
    home: defaultPose("home"),
    launch: defaultPose("launch"),
    sticky: defaultPose("sticky"),
    browser: defaultPose("browser"),
  };
}

function readLayout(): LayoutMap {
  const base = buildDefaults();
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Record<VrMovablePanelId, Partial<VrPanelPose>>>;
    for (const id of VR_MOVABLE_PANEL_IDS) {
      const entry = parsed[id];
      if (!entry?.position || !entry?.rotation) continue;
      const pos = entry.position;
      const rot = entry.rotation;
      if (
        !Array.isArray(pos)
        || pos.length !== 3
        || !Array.isArray(rot)
        || rot.length !== 3
        || pos.some((n) => typeof n !== "number" || !Number.isFinite(n))
        || rot.some((n) => typeof n !== "number" || !Number.isFinite(n))
      ) {
        continue;
      }
      base[id] = {
        position: clampPanelPosition(pos as [number, number, number]),
        rotation: [rot[0], rot[1], rot[2]],
      };
    }
  } catch {
    // ignore
  }
  return base;
}

function writeLayout(map: LayoutMap) {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

type VrLayoutStore = {
  poses: LayoutMap;
  setPose: (id: VrMovablePanelId, pose: VrPanelPose) => void;
  setPosition: (id: VrMovablePanelId, position: [number, number, number]) => void;
  resetPose: (id: VrMovablePanelId) => void;
  resetPoses: () => void;
};

export const useVrLayoutStore = create<VrLayoutStore>((set, get) => ({
  poses: readLayout(),
  setPose: (id, pose) => {
    const poses = {
      ...get().poses,
      [id]: {
        position: clampPanelPosition(pose.position),
        rotation: [...pose.rotation] as [number, number, number],
      },
    };
    writeLayout(poses);
    set({ poses });
  },
  setPosition: (id, position) => {
    const prev = get().poses[id] ?? defaultPose(id);
    get().setPose(id, {
      position: clampPanelPosition(position),
      rotation: prev.rotation,
    });
  },
  resetPose: (id) => {
    const poses = { ...get().poses, [id]: defaultPose(id) };
    writeLayout(poses);
    set({ poses });
  },
  resetPoses: () => {
    const poses = buildDefaults();
    writeLayout(poses);
    set({ poses });
  },
}));

export function getPanelPose(id: VrMovablePanelId): VrPanelPose {
  return clonePose(useVrLayoutStore.getState().poses[id] ?? defaultPose(id));
}
