import type { WebGLRenderer } from "three";
import { createProductXrSession } from "../xr";
import { getMmdVrRenderProfile, type MmdVrQualityInput } from "./mmdVrQuality";
import type { MmdVrRenderQuality } from "./mmdVrStore";

export type MmdVrAttachQuality = MmdVrRenderQuality | MmdVrQualityInput;

/** Dedicated XR session for MMD showcase — never share with VR desktop. */
const session = createProductXrSession<MmdVrAttachQuality>({
  resolveFrameRate: (quality) => getMmdVrRenderProfile(quality).frameRate,
  configureRenderer: (gl, quality) => {
    if (typeof quality === "string" || !quality.advancedRenderOverrides) return;
    const profile = getMmdVrRenderProfile(quality);
    gl.xr.setFramebufferScaleFactor(profile.framebufferScale);
    gl.xr.setFoveation(profile.foveation);
  },
  controller: {
    rayPointer: {
      rayModel: { color: "#9fd9ff", opacity: 0.62 },
      cursorModel: { color: "#ffffff", opacity: 0.95, size: 0.014, renderOrder: 100 },
    },
  },
});

export const mmdVrXrStore = session.xrStore;

export function peekPendingMmdVrSession() {
  return session.peek();
}

export function clearPendingMmdVrSession() {
  session.clear();
}

export function beginMmdVrSessionFromClick() {
  return session.beginFromClick();
}

export function applyMmdVrFrameRate(quality: MmdVrAttachQuality) {
  session.applyFrameRate(quality);
}

export function attachPendingMmdVrSessionToRenderer(
  gl: WebGLRenderer,
  quality?: MmdVrAttachQuality,
): Promise<boolean> {
  return session.attachToRenderer(gl, quality);
}

export function endMmdVrSession(): Promise<void> {
  return session.end();
}
