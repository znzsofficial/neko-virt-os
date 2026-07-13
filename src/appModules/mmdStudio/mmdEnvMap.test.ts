import { describe, expect, it } from "vitest";
import { cubeUvDefines } from "./mmdEnvMap";

describe("cubeUvDefines", () => {
  it("returns safe defaults for null", () => {
    const d = cubeUvDefines(null);
    expect(d.maxMip).toBe(8);
    expect(d.texelWidth).toBeCloseTo(1 / 256);
    expect(d.texelHeight).toBeCloseTo(1 / 256);
  });

  it("derives maxMip from atlas height", () => {
    const fake = {
      image: { width: 1024, height: 1024 },
    } as unknown as import("three").Texture;
    const d = cubeUvDefines(fake);
    // log2(1024) - 2 = 8
    expect(d.maxMip).toBe(8);
    expect(d.texelWidth).toBeCloseTo(1 / 1024);
    expect(d.texelHeight).toBeCloseTo(1 / 1024);
  });

  it("handles non-power-of-two height", () => {
    const fake = {
      image: { width: 500, height: 256 },
    } as unknown as import("three").Texture;
    const d = cubeUvDefines(fake);
    expect(d.maxMip).toBe(Math.log2(256) - 2);
    expect(d.texelWidth).toBeCloseTo(1 / 500);
  });
});
