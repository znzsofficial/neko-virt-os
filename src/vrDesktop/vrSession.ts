import { createXRStore } from "@react-three/xr";
import type { WebGLRenderer } from "three";
import type { VrRenderQuality } from "./vrDesktopStore";
import { getVrRenderProfile } from "./vrQuality";

/**
 * Shared XR store. Library enterVR() needs a mounted Canvas + <XR>.
 * Quest path: requestSession() on click → mount → gl.xr.setSession(pending).
 * frameRate default mid; applyVrFrameRate() runs after setSession from quality pref.
 */
export const vrXrStore = createXRStore({
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

/**
 * Session from click-time requestSession, held until the renderer attaches it.
 * Do not clear on attach failure / Strict Mode remount — only take once success
 * or explicit end/clear.
 */
let pendingSession: XRSession | null = null;
let attachInFlight = false;

export function peekPendingVrSession(): XRSession | null {
  return pendingSession;
}

export function clearPendingVrSession() {
  pendingSession = null;
  attachInFlight = false;
}

export function getXrSystem(): XRSystem | null {
  try {
    return (navigator as Navigator & { xr?: XRSystem | null }).xr ?? null;
  } catch {
    return null;
  }
}

export type XrDiagnostics = {
  secure: boolean;
  hasXr: boolean;
  protocol: string;
  host: string;
  summary: string;
};

/** Snapshot for Settings / notifications (Quest has no console). */
export function getXrDiagnostics(): XrDiagnostics {
  const secure = typeof window !== "undefined" ? window.isSecureContext : false;
  const hasXr = Boolean(getXrSystem());
  const protocol = typeof location !== "undefined" ? location.protocol : "?";
  const host = typeof location !== "undefined" ? location.host : "?";
  return {
    secure,
    hasXr,
    protocol,
    host,
    summary: `secure=${secure} xr=${hasXr} ${protocol}//${host}`,
  };
}

/** Minimal init for Meta Quest Browser. */
export function buildQuestVrSessionInit(): XRSessionInit {
  return {
    requiredFeatures: ["local-floor"],
    // No hand-tracking optional — we don't use hands and it can add cost on Quest.
    optionalFeatures: ["bounded-floor"],
  };
}

/**
 * MUST run synchronously from a click handler (no await before this call).
 * Starts requestSession while user activation is still valid.
 */
export function beginVrSessionFromClick(): Promise<XRSession> {
  const xr = getXrSystem();
  if (!xr) {
    return Promise.reject(new Error(`WebXR missing (${getXrDiagnostics().summary})`));
  }
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return Promise.reject(new Error(`Insecure context (${getXrDiagnostics().summary})`));
  }

  // End any leftover session before requesting a new one.
  if (pendingSession) {
    try {
      void pendingSession.end();
    } catch {
      // ignore
    }
    pendingSession = null;
  }
  attachInFlight = false;

  return xr.requestSession("immersive-vr", buildQuestVrSessionInit()).then((session) => {
    pendingSession = session;
    session.addEventListener(
      "end",
      () => {
        if (pendingSession === session) pendingSession = null;
        attachInFlight = false;
      },
      { once: true },
    );
    return session;
  });
}

/**
 * Bind pending XRSession to three WebXRManager after Canvas mounts.
 * Safe under React Strict Mode: does not drop the session until attach succeeds.
 */
export async function attachPendingSessionToRenderer(
  gl: WebGLRenderer,
  quality?: VrRenderQuality,
): Promise<boolean> {
  const session = pendingSession;
  if (!session) return false;
  if (attachInFlight) return false;
  if (gl.xr.enabled && gl.xr.isPresenting) return true;

  attachInFlight = true;
  try {
    await gl.xr.setSession(session);
    if (quality) applyVrFrameRate(quality);
    // Only clear after successful attach so a remount can retry if needed.
    if (pendingSession === session) pendingSession = null;
    return true;
  } catch (err) {
    attachInFlight = false;
    throw err;
  } finally {
    attachInFlight = false;
  }
}

/** Apply XR target frame rate from VR quality pref (after session exists). */
export function applyVrFrameRate(quality: VrRenderQuality) {
  const profile = getVrRenderProfile(quality);
  try {
    vrXrStore.setFrameRate(profile.frameRate);
  } catch {
    // ignore if no session yet
  }
}

export async function endVrDesktopSession(): Promise<void> {
  const pending = pendingSession;
  pendingSession = null;
  attachInFlight = false;

  if (pending) {
    try {
      await pending.end();
    } catch {
      // ignore
    }
  }

  try {
    const session = vrXrStore.getState().session;
    if (session) await session.end();
  } catch {
    // ignore
  }
}
