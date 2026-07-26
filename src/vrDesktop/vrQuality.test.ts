import { describe, expect, it } from "vitest";
import { formatVrProfileSummary, getVrRenderProfile } from "./vrQuality";

describe("getVrRenderProfile", () => {
  it("uses preset when only quality string", () => {
    const high = getVrRenderProfile("high");
    expect(high.antialias).toBe(true);
    expect(high.panelScale).toBe(1);
    expect(high.frameRate).toBe("high");
  });

  it("applies fine overrides", () => {
    const profile = getVrRenderProfile({
      renderQuality: "low",
      dprPref: "1.5",
      panelScalePref: "high",
      frameRatePref: "high",
      antialiasPref: "on",
      framebufferScalePref: "1",
      foveationPref: "off",
      floorDetailPref: "high",
    });
    expect(profile.dpr).toEqual([1, 1.5]);
    expect(profile.panelScale).toBe(1);
    expect(profile.frameRate).toBe("high");
    expect(profile.antialias).toBe(true);
    expect(profile.framebufferScale).toBe(1);
    expect(profile.foveation).toBe(0);
    expect(profile.floorSegments).toBe(48);
    // low preset still disallows soft edges
    expect(profile.allowSoftEdges).toBe(false);
  });

  it("formats summary", () => {
    const s = formatVrProfileSummary(getVrRenderProfile("balanced"), "zh");
    expect(s).toContain("DPR");
    expect(s).toContain("面板");
  });
});
