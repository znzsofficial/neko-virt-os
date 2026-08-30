import { describe, expect, it } from "vitest";
import { DEFAULT_SYSTEM_PREFS, normalizeSystemPrefs } from "./systemPrefs";

describe("system preferences", () => {
  it("defaults to an icon-only taskbar", () => {
    expect(DEFAULT_SYSTEM_PREFS.taskbarShowLabels).toBe(false);
    expect(normalizeSystemPrefs().taskbarShowLabels).toBe(false);
  });

  it("preserves an explicit taskbar label preference", () => {
    expect(normalizeSystemPrefs({ taskbarShowLabels: true }).taskbarShowLabels).toBe(true);
    expect(normalizeSystemPrefs({ taskbarShowLabels: false }).taskbarShowLabels).toBe(false);
  });
});
