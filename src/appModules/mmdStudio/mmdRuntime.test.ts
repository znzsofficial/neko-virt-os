import { describe, expect, it, vi } from "vitest";
import type { ThreeMmdModel } from "@yohawing/three-mmd-loader";
import {
  bindStaticMmdPhysicsRuntime,
  isMmdRuntimeRebuildError,
  MmdRuntimeRebuildError,
} from "./mmdRuntime";

describe("bindStaticMmdPhysicsRuntime", () => {
  it("identifies only the dedicated rebuild recovery failure", () => {
    const error = new MmdRuntimeRebuildError(new Error("rebuild"), new Error("restore"));
    expect(isMmdRuntimeRebuildError(error)).toBe(true);
    expect(isMmdRuntimeRebuildError(new AggregateError([], "unrelated"))).toBe(false);
    expect(error.errors).toHaveLength(2);
  });
  it("binds a no-motion model with an empty internal animation", () => {
    const setAnimation = vi.fn();
    const model = { setAnimation } as unknown as Pick<ThreeMmdModel, "setAnimation">;

    bindStaticMmdPhysicsRuntime(model);

    expect(setAnimation).toHaveBeenCalledOnce();
    expect(setAnimation).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "vmd", boneTracks: {}, morphTracks: {} }),
    );
  });
});
