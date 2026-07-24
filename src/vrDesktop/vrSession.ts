import type { WebGLRenderer } from "three";
import {
  createProductXrSession,
  getXrDiagnostics,
  getXrSystem,
  buildQuestVrSessionInit,
  type XrDiagnostics,
} from "../xr";
import type { VrDesktopPrefs, VrRenderQuality } from "./vrDesktopStore";
import { getVrRenderProfile, type VrQualityInput } from "./vrQuality";

export type { XrDiagnostics };
export { getXrDiagnostics, getXrSystem, buildQuestVrSessionInit };

export type VrAttachQuality =
  | VrRenderQuality
  | VrQualityInput
  | Pick<
      VrDesktopPrefs,
      "renderQuality" | "dprPref" | "panelScalePref" | "frameRatePref" | "antialiasPref"
    >;

/** Dedicated XR session for VR desktop — never share with MMD showcase. */
const session = createProductXrSession<VrAttachQuality>({
  resolveFrameRate: (quality) => getVrRenderProfile(quality).frameRate,
});

export const vrXrStore = session.xrStore;

export function peekPendingVrSession() {
  return session.peek();
}

export function clearPendingVrSession() {
  session.clear();
}

export function beginVrSessionFromClick() {
  return session.beginFromClick();
}

export function applyVrFrameRate(quality: VrAttachQuality) {
  session.applyFrameRate(quality);
}

export function attachPendingSessionToRenderer(
  gl: WebGLRenderer,
  quality?: VrAttachQuality,
): Promise<boolean> {
  return session.attachToRenderer(gl, quality);
}

export function endVrDesktopSession(): Promise<void> {
  return session.end();
}
