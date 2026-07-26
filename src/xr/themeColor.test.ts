import { describe, expect, it } from "vitest";
import { getXrAccentTokens, normalizeXrThemeColor } from "./themeColor";

describe("XR theme colors", () => {
  it("defaults unknown values to blue", () => {
    expect(normalizeXrThemeColor(undefined)).toBe("blue");
    expect(normalizeXrThemeColor("orange")).toBe("blue");
  });

  it("keeps supported colors independent", () => {
    expect(getXrAccentTokens("cyan").primary).not.toBe(getXrAccentTokens("purple").primary);
    expect(normalizeXrThemeColor("red")).toBe("red");
  });
});
