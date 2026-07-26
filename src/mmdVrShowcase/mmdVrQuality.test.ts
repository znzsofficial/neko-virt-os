import { describe, expect, it } from "vitest";
import { getMmdVrRenderProfile } from "./mmdVrQuality";

describe("getMmdVrRenderProfile", () => {
  it("applies XR and shadow quality overrides", () => {
    const profile = getMmdVrRenderProfile({
      renderQuality: "low",
      dprPref: "auto",
      frameRatePref: "auto",
      antialiasPref: "auto",
      shadowsPref: "on",
      gridPref: "auto",
      walkSpeedPref: "auto",
      framebufferScalePref: "1",
      foveationPref: "off",
      shadowResolutionPref: "high",
    });

    expect(profile.shadows).toBe(true);
    expect(profile.shadowMapSize).toBe(2048);
    expect(profile.framebufferScale).toBe(1);
    expect(profile.foveation).toBe(0);
  });
});
