import { describe, expect, it } from "vitest";
import {
  applyCommonQualityAxes,
  formatDprLabel,
  formatFrameRateLabel,
  scalePanelSize,
} from "./qualityAxes";

describe("applyCommonQualityAxes", () => {
  it("overrides dpr / aa / frameRate", () => {
    const base = { dpr: 1 as number | [number, number], antialias: false, frameRate: "low" as const };
    const next = applyCommonQualityAxes(base, {
      dprPref: "1.5",
      antialiasPref: "on",
      frameRatePref: "high",
    });
    expect(next.dpr).toEqual([1, 1.5]);
    expect(next.antialias).toBe(true);
    expect(next.frameRate).toBe("high");
  });

  it("leaves auto prefs alone", () => {
    const base = { dpr: 1 as number | [number, number], antialias: false, frameRate: "mid" as const };
    const next = applyCommonQualityAxes(base, {
      dprPref: "auto",
      antialiasPref: "auto",
      frameRatePref: "auto",
    });
    expect(next).toEqual(base);
  });
});

describe("format helpers", () => {
  it("formats dpr and fps", () => {
    expect(formatDprLabel(1)).toBe("1");
    expect(formatDprLabel([1, 1.25])).toBe("1–1.25");
    expect(formatFrameRateLabel("high")).toBe("72+");
    expect(formatFrameRateLabel(false)).toBe("—");
  });

  it("scales panel size to even ints", () => {
    expect(scalePanelSize(100, 0.75) % 2).toBe(0);
    expect(scalePanelSize(10, 0.1)).toBeGreaterThanOrEqual(64);
  });
});
