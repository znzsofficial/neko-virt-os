// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { defaultPose } from "./vrLayout";
import { useVrLayoutStore } from "./vrLayoutStore";

describe("vrLayoutStore", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    localStorage.clear();
    useVrLayoutStore.getState().resetPoses();
  });

  it("resets one panel without changing the other poses", () => {
    const launchPosition: [number, number, number] = [2, 1.2, -2];
    useVrLayoutStore.getState().setPosition("launch", launchPosition);
    useVrLayoutStore.getState().setPosition("sticky", [3, 2, -4]);

    useVrLayoutStore.getState().resetPose("sticky");

    expect(useVrLayoutStore.getState().poses.sticky).toEqual(defaultPose("sticky"));
    expect(useVrLayoutStore.getState().poses.launch.position).toEqual(launchPosition);
  });
});
