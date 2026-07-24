import type { WebGLRenderer } from "three";
import { createAppXrStore, type AppXrStore } from "./createAppXrStore";
import { createPendingSessionSlot, type PendingSessionSlot } from "./pendingSessionSlot";
import type { ImmersiveFrameRate } from "./qualityAxes";

export type ProductXrSession<Q> = {
  xrStore: AppXrStore;
  slot: PendingSessionSlot;
  peek: () => XRSession | null;
  clear: () => void;
  beginFromClick: () => Promise<XRSession>;
  applyFrameRate: (quality: Q) => void;
  attachToRenderer: (gl: WebGLRenderer, quality?: Q) => Promise<boolean>;
  end: () => Promise<void>;
};

/**
 * One XR store + pending slot + frame-rate apply for a product surface.
 * Call once per surface (desktop / MMD) — never share the returned instance.
 */
export function createProductXrSession<Q>(opts: {
  resolveFrameRate: (quality: Q) => ImmersiveFrameRate;
}): ProductXrSession<Q> {
  const xrStore = createAppXrStore();
  const slot = createPendingSessionSlot();

  function applyFrameRate(quality: Q) {
    try {
      xrStore.setFrameRate(opts.resolveFrameRate(quality));
    } catch {
      // ignore if no session yet
    }
  }

  return {
    xrStore,
    slot,
    peek: () => slot.peek(),
    clear: () => slot.clear(),
    beginFromClick: () => slot.beginFromClick(),
    applyFrameRate,
    attachToRenderer: (gl, quality) =>
      slot.attachToRenderer(gl, quality !== undefined ? () => applyFrameRate(quality) : undefined),
    end: () => slot.end(() => xrStore.getState().session),
  };
}
