import { beforeEach, describe, expect, it } from "vitest";
import {
  normalizeMmdVrHeightOffset,
  normalizeMmdVrModelScale,
  normalizeMmdVrPrefs,
  useMmdVrStore,
} from "./mmdVrStore";
import {
  fineTuneMmdVrModelScale,
  mmdVrHeightOffsetToSlider,
  mmdVrModelScaleToSlider,
  mmdVrSliderToHeightOffset,
  mmdVrSliderToModelScale,
  mmdVrSliderToViewDistance,
  mmdVrViewDistanceToSlider,
  nextMmdVrModelScale,
  previousMmdVrModelScale,
} from "./mmdVrAdjustments";

describe("MMD VR adjustments", () => {
  beforeEach(() => {
    useMmdVrStore.setState({
      models: [{ id: "model-1", name: "Miku.pmx", visible: true, scale: 1, rotationY: 0 }],
      modelCount: 1,
      placeModelId: "model-1",
      pendingModelTransforms: [],
      pendingModelRemovals: [],
    });
  });

  it("clamps model scale and user height", () => {
    expect(normalizeMmdVrModelScale(0.001)).toBe(0.01);
    expect(normalizeMmdVrModelScale(12)).toBe(10);
    expect(normalizeMmdVrHeightOffset(-3)).toBe(-2);
    expect(normalizeMmdVrHeightOffset(21)).toBe(20);
    expect(normalizeMmdVrPrefs({ viewDistance: 2 }).viewDistance).toBe(10);
    expect(normalizeMmdVrPrefs({ viewDistance: 120 }).viewDistance).toBe(100);
    expect(normalizeMmdVrPrefs({ snapTurnDegrees: 45, exposure: 2 })).toMatchObject({
      snapTurnDegrees: 45,
      exposure: 1.3,
    });
  });

  it("uses useful nonlinear scale steps at very small and normal sizes", () => {
    expect(previousMmdVrModelScale(1)).toBe(0.8);
    expect(nextMmdVrModelScale(1)).toBe(1.25);
    expect(previousMmdVrModelScale(0.1)).toBe(0.075);
    expect(nextMmdVrModelScale(0.1)).toBe(0.15);
  });

  it("maps the continuous sliders across their complete ranges", () => {
    expect(mmdVrSliderToModelScale(0)).toBe(0.01);
    expect(mmdVrSliderToModelScale(1)).toBe(10);
    expect(mmdVrModelScaleToSlider(1)).toBeCloseTo(2 / 3);
    expect(mmdVrSliderToHeightOffset(0)).toBe(-2);
    expect(mmdVrSliderToHeightOffset(1)).toBe(20);
    expect(mmdVrHeightOffsetToSlider(0)).toBeCloseTo(1 / 11);
    expect(fineTuneMmdVrModelScale(1, -1)).toBe(0.952);
    expect(fineTuneMmdVrModelScale(1, 1)).toBe(1.05);
    expect(mmdVrSliderToViewDistance(0)).toBe(10);
    expect(mmdVrSliderToViewDistance(1)).toBe(100);
    expect(mmdVrViewDistanceToSlider(40)).toBeCloseTo(1 / 3);
  });

  it("updates the displayed model scale and keeps only the latest request", () => {
    const store = useMmdVrStore.getState();
    store.requestModelScale("model-1", 1.1);
    useMmdVrStore.getState().requestModelScale("model-1", 1.2);

    expect(useMmdVrStore.getState().models[0].scale).toBe(1.2);
    expect(useMmdVrStore.getState().takeModelTransformRequests()).toEqual([
      { id: "model-1", scale: 1.2 },
    ]);
    expect(useMmdVrStore.getState().pendingModelTransforms).toEqual([]);
  });

  it("queues rotation and full reset requests per model", () => {
    const store = useMmdVrStore.getState();
    store.requestModelRotation("model-1", -15);
    useMmdVrStore.getState().requestModelScale("model-1", 1.5);

    expect(useMmdVrStore.getState().models[0]).toMatchObject({ rotationY: 345, scale: 1.5 });
    expect(useMmdVrStore.getState().takeModelTransformRequests()).toEqual([
      { id: "model-1", rotationY: 345, scale: 1.5 },
    ]);

    useMmdVrStore.getState().requestModelReset("model-1");
    expect(useMmdVrStore.getState().models[0]).toMatchObject({ rotationY: 0, scale: 1 });
    expect(useMmdVrStore.getState().takeModelTransformRequests()).toEqual([
      { id: "model-1", reset: true },
    ]);

    useMmdVrStore.getState().requestModelReset("model-1");
    useMmdVrStore.getState().requestModelRotation("model-1", 15);
    expect(useMmdVrStore.getState().takeModelTransformRequests()).toEqual([
      { id: "model-1", rotationY: 15 },
    ]);
  });

  it("queues each existing model for removal once", () => {
    const store = useMmdVrStore.getState();
    store.enqueueModelRemoval("model-1");
    useMmdVrStore.getState().enqueueModelRemoval("model-1");
    useMmdVrStore.getState().enqueueModelRemoval("missing");

    expect(useMmdVrStore.getState().takeModelRemovals()).toEqual(["model-1"]);
    expect(useMmdVrStore.getState().takeModelRemovals()).toEqual([]);
  });

  it("cycles through all six lighting modes", () => {
    useMmdVrStore.getState().setPrefs({ lightPreset: "stage" });
    const seen = [useMmdVrStore.getState().prefs.lightPreset];
    for (let index = 0; index < 5; index += 1) {
      useMmdVrStore.getState().cycleLightPreset();
      seen.push(useMmdVrStore.getState().prefs.lightPreset);
    }

    expect(seen).toEqual(["stage", "soft", "daylight", "warm", "rim", "contrast"]);
    useMmdVrStore.getState().cycleLightPreset();
    expect(useMmdVrStore.getState().prefs.lightPreset).toBe("stage");
  });

  it("keeps experimental physics session-only and off after exit", () => {
    useMmdVrStore.getState().setPhysicsEnabled(true);
    useMmdVrStore.getState().setPhysicsDebugEnabled(true);
    useMmdVrStore.getState().setPhysicsBusy(true);

    useMmdVrStore.getState().closeOverlay();

    expect(useMmdVrStore.getState()).toMatchObject({
      physicsEnabled: false,
      physicsDebugEnabled: false,
      physicsBusy: false,
    });
  });

  it("clears physics diagnostics when debug display is disabled", () => {
    useMmdVrStore.setState({
      physicsDebugEnabled: true,
      physicsContactCount: 2,
      physicsDynamicBodyCount: 12,
      physicsRigidBodyCount: 20,
      physicsStepCount: 30,
    });

    useMmdVrStore.getState().setPhysicsDebugEnabled(false);

    expect(useMmdVrStore.getState()).toMatchObject({
      physicsDebugEnabled: false,
      physicsContactCount: 0,
      physicsDynamicBodyCount: 0,
      physicsRigidBodyCount: 0,
      physicsStepCount: 0,
    });
  });

  it("cycles session physics controls and restores defaults after exit", () => {
    const store = useMmdVrStore.getState();
    store.cyclePhysicsColliderRadius();
    useMmdVrStore.getState().cyclePhysicsQuality();
    useMmdVrStore.getState().setPhysicsControllerCollisions(false);
    useMmdVrStore.getState().setPhysicsHapticsEnabled(true);
    useMmdVrStore.getState().requestPhysicsReset();

    expect(useMmdVrStore.getState()).toMatchObject({
      physicsColliderRadius: 0.12,
      physicsQuality: "high",
      physicsControllerCollisions: false,
      physicsHapticsEnabled: true,
      physicsResetEpoch: 1,
    });

    useMmdVrStore.getState().closeOverlay();

    expect(useMmdVrStore.getState()).toMatchObject({
      physicsColliderRadius: 0.08,
      physicsQuality: "medium",
      physicsControllerCollisions: true,
      physicsHapticsEnabled: false,
      physicsResetEpoch: 0,
    });
  });
});
