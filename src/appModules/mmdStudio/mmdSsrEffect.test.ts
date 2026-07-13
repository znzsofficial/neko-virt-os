import { describe, expect, it } from "vitest";
import { ssrIntensityForExport, ssrQualityFromPixels } from "./mmdSsrEffect";

describe("ssrQualityFromPixels", () => {
  it("raises quality with user amount at 720p", () => {
    const low = ssrQualityFromPixels(1280 * 720, 0.2);
    const high = ssrQualityFromPixels(1280 * 720, 1);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(1);
    expect(low).toBeGreaterThanOrEqual(0.15);
  });

  it("drops quality above 1080p", () => {
    const at720 = ssrQualityFromPixels(1280 * 720, 0.8);
    const at1080 = ssrQualityFromPixels(1920 * 1080 + 1, 0.8);
    expect(at1080).toBeLessThan(at720);
  });

  it("export mode is cheaper than preview", () => {
    const preview = ssrQualityFromPixels(1920 * 1080, 0.7);
    const exp = ssrQualityFromPixels(1920 * 1080, 0.7, { exportMode: true });
    expect(exp).toBeLessThan(preview);
  });

  it("stays within 0.15–1", () => {
    for (const px of [640 * 360, 1280 * 720, 1920 * 1080, 3840 * 2160]) {
      for (const u of [0, 0.5, 1]) {
        const q = ssrQualityFromPixels(px, u);
        expect(q).toBeGreaterThanOrEqual(0.15);
        expect(q).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("ssrIntensityForExport", () => {
  it("lowers intensity when exporting", () => {
    expect(ssrIntensityForExport(0.6, true)).toBeLessThan(ssrIntensityForExport(0.6, false));
  });
});
