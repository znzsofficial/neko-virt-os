import { describe, expect, it, vi } from "vitest";
import type { ThreeMmdModel } from "@yohawing/three-mmd-loader";
import { bindStaticMmdPhysicsRuntime } from "./mmdRuntime";

describe("bindStaticMmdPhysicsRuntime", () => {
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
