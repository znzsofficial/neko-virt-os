import { create } from "zustand";
import { createLocalPrefsStorage } from "../shared/localPrefs";
import {
  normalizeImmersiveQuality,
} from "../xr";
import { getXrDiagnostics, getXrSystem } from "./vrSession";
import {
  VR_DESKTOP_PREFS_KEY,
  VR_DESKTOP_PREFS_LEGACY_KEY,
  normalizeVrDesktopPrefs,
  type VrDesktopPrefs,
} from "./vrDesktopPrefs";

export type {
  VrAntialiasPref,
  VrDesktopPrefs,
  VrDprPref,
  VrFrameRatePref,
  VrFramebufferScalePref,
  VrFoveationPref,
  VrFloorDetailPref,
  VrPanelScalePref,
  VrRenderQuality,
} from "./vrDesktopPrefs";

export type VrSessionPhase = "idle" | "entering" | "active" | "error";

/**
 * UI readiness (does not replace click-time requestSession).
 * - unknown: not refreshed yet
 * - unavailable: non-secure context — cannot enter
 * - ready: secure + navigator.xr
 * - limited: secure but no navigator.xr
 */
export type VrCapability = "unknown" | "unavailable" | "ready" | "limited";

type VrDesktopStore = {
  prefs: VrDesktopPrefs;
  setPrefs: (patch: Partial<VrDesktopPrefs>) => void;
  capability: VrCapability;
  /** true only when isSessionSupported reports true; never set false from a false probe. */
  sessionSupported: boolean | null;
  phase: VrSessionPhase;
  errorMessage: string | null;
  lastError: string | null;
  setLastError: (value: string | null) => void;
  setPhase: (phase: VrSessionPhase, errorMessage?: string | null) => void;
  overlayOpen: boolean;
  openOverlay: () => void;
  closeOverlay: () => void;
  failEnter: (errorMessage?: string | null) => void;
  markEntered: () => void;
  refreshCapability: () => Promise<void>;
  /**
   * Bumped on "reset layout" — scene rebinds default poses + zeros XROrigin.
   * Not persisted (runtime only).
   */
  layoutEpoch: number;
  resetLayout: () => void;
};

const prefsStorage = createLocalPrefsStorage<VrDesktopPrefs>({
  key: VR_DESKTOP_PREFS_KEY,
  legacyKey: VR_DESKTOP_PREFS_LEGACY_KEY,
  defaults: () => ({
    enabled: true,
    softEdges: false,
    renderQuality: "balanced",
    showFps: false,
    dprPref: "auto",
    panelScalePref: "auto",
    frameRatePref: "auto",
    antialiasPref: "auto",
    framebufferScalePref: "auto",
    foveationPref: "auto",
    floorDetailPref: "auto",
    themeColor: "blue",
  }),
  normalize: normalizeVrDesktopPrefs,
});

function computeCapability(): VrCapability {
  if (typeof window === "undefined") return "unknown";
  if (!window.isSecureContext) return "unavailable";
  if (!getXrSystem()) return "limited";
  return "ready";
}

/**
 * Refresh capability. isSessionSupported is advisory:
 * only `true` is stored; false/throw never disable enter.
 */
export async function refreshVrCapability(): Promise<void> {
  const capability = computeCapability();

  if (capability === "unavailable") {
    useVrDesktopStore.setState({ capability, sessionSupported: false });
    return;
  }

  if (capability === "limited") {
    useVrDesktopStore.setState({ capability, sessionSupported: null });
    return;
  }

  const patch: { capability: VrCapability; sessionSupported?: boolean } = { capability };
  const xr = getXrSystem();
  if (xr && typeof xr.isSessionSupported === "function") {
    try {
      if (await xr.isSessionSupported("immersive-vr")) {
        patch.sessionSupported = true;
      }
    } catch {
      // ignore flaky probes
    }
  }
  useVrDesktopStore.setState(patch);
}

export const useVrDesktopStore = create<VrDesktopStore>((set, get) => ({
  prefs: prefsStorage.read(),
  setPrefs: (patch) => {
    const prefs = { ...get().prefs, ...patch };
    if (patch.renderQuality != null) {
      prefs.renderQuality = normalizeImmersiveQuality(patch.renderQuality);
    }
    const normalized = normalizeVrDesktopPrefs(prefs);
    Object.assign(prefs, normalized);
    prefsStorage.write(prefs);
    set({ prefs });
    if (prefs.enabled) void refreshVrCapability();
  },
  capability: typeof window === "undefined" ? "unknown" : computeCapability(),
  sessionSupported: null,
  phase: "idle",
  errorMessage: null,
  lastError: null,
  setLastError: (lastError) => set({ lastError }),
  setPhase: (phase, errorMessage = null) => set({ phase, errorMessage }),
  overlayOpen: false,
  openOverlay: () => set({ overlayOpen: true, errorMessage: null, lastError: null }),
  closeOverlay: () => set({ overlayOpen: false, phase: "idle", errorMessage: null }),
  failEnter: (errorMessage = "enter_failed") =>
    set({ overlayOpen: false, phase: "error", errorMessage, lastError: errorMessage }),
  markEntered: () =>
    set({
      capability: "ready",
      sessionSupported: true,
      lastError: null,
      overlayOpen: true,
      errorMessage: null,
      // Stay "entering" until AttachPendingSession → active (or fail).
      phase: "entering",
    }),
  refreshCapability: () => refreshVrCapability(),
  layoutEpoch: 0,
  resetLayout: () => {
    // Reset panel poses (persisted) + bump epoch so PlayerRig zeros XROrigin.
    void import("./vrLayoutStore").then((m) => m.useVrLayoutStore.getState().resetPoses());
    set((s) => ({ layoutEpoch: s.layoutEpoch + 1 }));
  },
}));

export function formatVrCapabilityHint(
  capability: VrCapability,
  sessionSupported: boolean | null,
): string {
  const diag = getXrDiagnostics().summary;
  if (capability === "unavailable") return `HTTPS required · ${diag}`;
  if (capability === "limited") return `WebXR API missing · ${diag}`;
  if (capability === "ready" && sessionSupported === true) return `WebXR ready · ${diag}`;
  if (capability === "ready") return `WebXR available · ${diag}`;
  return diag;
}
