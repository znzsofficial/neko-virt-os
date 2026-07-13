import { describe, expect, it } from "vitest";
import {
  clampSideWidth,
  clampTransportHeight,
  MMD_SIDE_WIDTH_DEFAULT,
  MMD_SIDE_WIDTH_MAX,
  MMD_SIDE_WIDTH_MIN,
  MMD_TRANSPORT_HEIGHT_DEFAULT,
  MMD_TRANSPORT_HEIGHT_MAX,
  MMD_TRANSPORT_HEIGHT_MIN,
  readMmdLayoutPrefs,
  writeMmdLayoutPrefs,
} from "./mmdLayoutPrefs";

describe("clampSideWidth / clampTransportHeight", () => {
  it("clamps side width into allowed range", () => {
    expect(clampSideWidth(10)).toBe(MMD_SIDE_WIDTH_MIN);
    expect(clampSideWidth(9999)).toBe(MMD_SIDE_WIDTH_MAX);
    expect(clampSideWidth(MMD_SIDE_WIDTH_DEFAULT + 0.4)).toBe(MMD_SIDE_WIDTH_DEFAULT);
  });

  it("clamps transport height into allowed range", () => {
    expect(clampTransportHeight(1)).toBe(MMD_TRANSPORT_HEIGHT_MIN);
    expect(clampTransportHeight(999)).toBe(MMD_TRANSPORT_HEIGHT_MAX);
    expect(clampTransportHeight(MMD_TRANSPORT_HEIGHT_DEFAULT)).toBe(MMD_TRANSPORT_HEIGHT_DEFAULT);
  });
});

describe("readMmdLayoutPrefs / writeMmdLayoutPrefs", () => {
  it("round-trips valid prefs through localStorage", () => {
    const memory = new Map<string, string>();
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => {
          memory.set(key, value);
        },
        removeItem: (key: string) => {
          memory.delete(key);
        },
      },
    });

    try {
      writeMmdLayoutPrefs({
        sideWidth: 360,
        sideCollapsed: true,
        transportHeight: 160,
      });
      expect(readMmdLayoutPrefs()).toEqual({
        sideWidth: 360,
        sideCollapsed: true,
        transportHeight: 160,
      });

      writeMmdLayoutPrefs({
        sideWidth: 12,
        sideCollapsed: false,
        transportHeight: 999,
      });
      expect(readMmdLayoutPrefs()).toEqual({
        sideWidth: MMD_SIDE_WIDTH_MIN,
        sideCollapsed: false,
        transportHeight: MMD_TRANSPORT_HEIGHT_MAX,
      });
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: original,
      });
    }
  });
});
