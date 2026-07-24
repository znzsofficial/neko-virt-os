import type * as THREE from "three";

/**
 * Latest PMREM CubeUV for toon IBL (read by MmdCanvas lighting sync).
 * Kept out of MmdSky.tsx so Fast Refresh can treat that file as components-only.
 */

let activePmremEnvMap: THREE.Texture | null = null;
const pmremListeners = new Set<(map: THREE.Texture | null) => void>();

export function getActivePmremEnvMap() {
  return activePmremEnvMap;
}

export function subscribePmremEnvMap(listener: (map: THREE.Texture | null) => void) {
  pmremListeners.add(listener);
  listener(activePmremEnvMap);
  return () => {
    pmremListeners.delete(listener);
  };
}

export function publishPmremEnvMap(map: THREE.Texture | null) {
  activePmremEnvMap = map;
  for (const listener of pmremListeners) listener(map);
}
