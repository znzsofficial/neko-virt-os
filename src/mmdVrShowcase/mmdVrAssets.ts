/** Max concurrent models in the showcase (roadmap v0). */
export const MMD_VR_MAX_MODELS = 3;

export type MmdVrAssetSlot = {
  modelFile: File;
  companionFiles: File[];
  bodyMotionFile: File | null;
  faceMotionFile?: File | null;
};

function normalizeSlots(slots: readonly MmdVrAssetSlot[]): MmdVrAssetSlot[] {
  return slots.slice(0, MMD_VR_MAX_MODELS).map((slot) => ({
    modelFile: slot.modelFile,
    companionFiles: slot.companionFiles?.length ? [...slot.companionFiles] : [slot.modelFile],
    bodyMotionFile: slot.bodyMotionFile ?? null,
    faceMotionFile: slot.faceMotionFile ?? null,
  }));
}

/** Staged by enter click; moved into sessionAssets on successful requestSession. */
let pendingAssets: MmdVrAssetSlot[] = [];

/**
 * Active handoff for the current XR overlay.
 * Survives React Strict Mode remounts (do not clear on scene unmount).
 * Cleared on overlay close / enter fail.
 */
let sessionAssets: MmdVrAssetSlot[] | null = null;

export function setMmdVrPendingAssets(slots: readonly MmdVrAssetSlot[]) {
  pendingAssets = normalizeSlots(slots);
}

export function peekMmdVrPendingAssets(): readonly MmdVrAssetSlot[] {
  return pendingAssets;
}

/** @deprecated prefer begin/get session; kept for tests */
export function takeMmdVrPendingAssets(): MmdVrAssetSlot[] {
  const next = pendingAssets;
  pendingAssets = [];
  return next;
}

/**
 * After requestSession succeeds: promote pending → session (or keep existing session).
 * Safe to call on remount — does not wipe sessionAssets.
 */
export function beginMmdVrAssetSession(slots?: readonly MmdVrAssetSlot[]) {
  if (slots?.length) {
    sessionAssets = normalizeSlots(slots);
    pendingAssets = [];
    return;
  }
  if (pendingAssets.length) {
    sessionAssets = pendingAssets;
    pendingAssets = [];
  }
}

export function getMmdVrSessionAssets(): readonly MmdVrAssetSlot[] {
  return sessionAssets ?? [];
}

export function clearMmdVrPendingAssets() {
  pendingAssets = [];
}

export function endMmdVrAssetSession() {
  sessionAssets = null;
  pendingAssets = [];
}

export function clearMmdVrPendingAssetsAll() {
  endMmdVrAssetSession();
}
