import { describe, expect, it } from "vitest";
import { isValidNotificationTime, normalizeNotificationPrefs } from "./notificationPrefs";

describe("notification preferences", () => {
  it("accepts valid 24-hour times and rejects malformed values", () => {
    expect(isValidNotificationTime("00:00")).toBe(true);
    expect(isValidNotificationTime("23:59")).toBe(true);
    expect(isValidNotificationTime("24:00")).toBe(false);
    expect(isValidNotificationTime("9:00")).toBe(false);
  });

  it("normalizes invalid schedule values to safe defaults", () => {
    const prefs = normalizeNotificationPrefs({ dndStart: "25:00", dndEnd: "noon" });
    expect(prefs.dndStart).toBe("22:00");
    expect(prefs.dndEnd).toBe("08:00");
  });
});
