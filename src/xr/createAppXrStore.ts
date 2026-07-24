import { createXRStore } from "@react-three/xr";

/**
 * Shared XR store defaults for NekoVirtOS immersive sessions.
 * Each product surface (desktop / MMD) must call this once for its own store instance.
 */
export function createAppXrStore() {
  return createXRStore({
    hand: false,
    controller: true,
    gaze: false,
    screenInput: true,
    transientPointer: true,
    layers: false,
    meshDetection: false,
    planeDetection: false,
    anchors: false,
    hitTest: false,
    depthSensing: false,
    bodyTracking: false,
    handTracking: false,
    domOverlay: false,
    offerSession: false,
    enterGrantedSession: false,
    frameRate: "mid",
    emulate: false,
  });
}

export type AppXrStore = ReturnType<typeof createAppXrStore>;
