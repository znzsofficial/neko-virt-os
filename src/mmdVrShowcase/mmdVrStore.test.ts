import { beforeEach, describe, expect, it } from "vitest";
import {
  normalizeMmdVrHeightOffset,
  normalizeMmdVrModelScale,
  useMmdVrStore,
} from "./mmdVrStore";
import { nextMmdVrModelScale, previousMmdVrModelScale } from "./mmdVrAdjustments";

describe("MMD VR adjustments", () => {
  beforeEach(() => {
    useMmdVrStore.setState({
      models: [{ id: "model-1", name: "Miku.pmx", visible: true, scale: 1 }],
      modelCount: 1,
      placeModelId: "model-1",
      pendingModelScales: [],
    });
  });

  it("clamps model scale and user height", () => {
    expect(normalizeMmdVrModelScale(0.001)).toBe(0.01);
    expect(normalizeMmdVrModelScale(12)).toBe(10);
    expect(normalizeMmdVrHeightOffset(-2)).toBe(-1.5);
    expect(normalizeMmdVrHeightOffset(2)).toBe(1.5);
  });

  it("uses useful nonlinear scale steps at very small and normal sizes", () => {
    expect(previousMmdVrModelScale(1)).toBe(0.8);
    expect(nextMmdVrModelScale(1)).toBe(1.25);
    expect(previousMmdVrModelScale(0.1)).toBe(0.075);
    expect(nextMmdVrModelScale(0.1)).toBe(0.15);
  });

  it("updates the displayed model scale and keeps only the latest request", () => {
    const store = useMmdVrStore.getState();
    store.requestModelScale("model-1", 1.1);
    useMmdVrStore.getState().requestModelScale("model-1", 1.2);

    expect(useMmdVrStore.getState().models[0].scale).toBe(1.2);
    expect(useMmdVrStore.getState().takeModelScaleRequests()).toEqual([
      { id: "model-1", scale: 1.2 },
    ]);
    expect(useMmdVrStore.getState().pendingModelScales).toEqual([]);
  });
});
