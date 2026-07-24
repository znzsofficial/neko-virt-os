import { beforeEach, describe, expect, it } from "vitest";
import {
  getMmdVrClock,
  resetMmdVrClock,
  setMmdVrClockDuration,
  setMmdVrClockTime,
} from "./mmdVrClock";

describe("mmdVrClock", () => {
  beforeEach(() => {
    resetMmdVrClock();
  });

  it("resets cleanly", () => {
    setMmdVrClockDuration(10);
    setMmdVrClockTime(3, true);
    resetMmdVrClock();
    expect(getMmdVrClock().time).toBe(0);
    expect(getMmdVrClock().duration).toBe(0);
  });

  it("bumps paintVersion when duration changes", () => {
    const v0 = getMmdVrClock().paintVersion;
    setMmdVrClockDuration(12);
    expect(getMmdVrClock().duration).toBe(12);
    expect(getMmdVrClock().paintVersion).toBeGreaterThan(v0);
  });

  it("throttles paintVersion by time buckets unless forced", () => {
    setMmdVrClockDuration(10);
    setMmdVrClockTime(0, true);
    const v1 = getMmdVrClock().paintVersion;
    setMmdVrClockTime(0.05);
    expect(getMmdVrClock().paintVersion).toBe(v1);
    setMmdVrClockTime(0.2);
    expect(getMmdVrClock().paintVersion).toBeGreaterThan(v1);
    const v2 = getMmdVrClock().paintVersion;
    setMmdVrClockTime(0.2, true);
    expect(getMmdVrClock().paintVersion).toBeGreaterThan(v2);
  });
});
