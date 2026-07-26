export const MMD_VR_MODEL_SCALE_STEPS = [
  0.01, 0.02, 0.03, 0.05, 0.075, 0.1, 0.15, 0.2, 0.25, 0.35, 0.5, 0.65, 0.8, 1,
  1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10,
] as const;

export const MMD_VR_HEIGHT_OFFSET_MIN = -1.5;
export const MMD_VR_HEIGHT_OFFSET_MAX = 1.5;
export const MMD_VR_HEIGHT_OFFSET_STEP = 0.1;

export function normalizeMmdVrModelScale(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 1;
  return Math.round(Math.min(10, Math.max(0.01, n)) * 1000) / 1000;
}

export function previousMmdVrModelScale(value: number): number {
  const current = normalizeMmdVrModelScale(value);
  for (let i = MMD_VR_MODEL_SCALE_STEPS.length - 1; i >= 0; i -= 1) {
    if (MMD_VR_MODEL_SCALE_STEPS[i] < current - 1e-6) return MMD_VR_MODEL_SCALE_STEPS[i];
  }
  return MMD_VR_MODEL_SCALE_STEPS[0];
}

export function nextMmdVrModelScale(value: number): number {
  const current = normalizeMmdVrModelScale(value);
  for (const step of MMD_VR_MODEL_SCALE_STEPS) {
    if (step > current + 1e-6) return step;
  }
  return MMD_VR_MODEL_SCALE_STEPS[MMD_VR_MODEL_SCALE_STEPS.length - 1];
}

export function normalizeMmdVrHeightOffset(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.round(Math.min(MMD_VR_HEIGHT_OFFSET_MAX, Math.max(MMD_VR_HEIGHT_OFFSET_MIN, n)) * 100) / 100;
}

export function formatMmdVrModelScale(value: number): string {
  const scale = normalizeMmdVrModelScale(value);
  if (scale < 0.1) return `${scale.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}x`;
  return `${scale.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}x`;
}
