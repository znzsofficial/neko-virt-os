import { describe, expect, it } from "vitest";
import { DEFAULT_DEVELOPER_PREFS, normalizeDeveloperPrefs } from "./developerPrefs";

describe("normalizeDeveloperPrefs", () => {
  it("defaults missing fields", () => {
    expect(normalizeDeveloperPrefs({})).toEqual(DEFAULT_DEVELOPER_PREFS);
  });

  it("accepts power mode and toggles", () => {
    expect(
      normalizeDeveloperPrefs({
        animationQuality: "power",
        showFps: true,
        debugBorders: true,
        reduceMotion: true,
        largeTargets: true,
        highContrast: true,
      }),
    ).toEqual({
      animationQuality: "power",
      showFps: true,
      debugBorders: true,
      reduceMotion: true,
      largeTargets: true,
      highContrast: true,
    });
  });

  it("rejects invalid animation quality", () => {
    expect(
      normalizeDeveloperPrefs({
        animationQuality: "turbo" as "fluid",
      }).animationQuality,
    ).toBe("fluid");
  });

});
