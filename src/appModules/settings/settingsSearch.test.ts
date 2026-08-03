import { describe, expect, it } from "vitest";
import { filterSettingsSearch, type SettingsSearchEntry } from "./settingsSearch";

const entries: SettingsSearchEntry[] = [
  ["general", "settingsLanguage"],
  ["appearance", "settingsWallpaper"],
  ["data", "settingsImport"],
];

describe("settings search", () => {
  it("matches translated labels case-insensitively and trims the query", () => {
    expect(filterSettingsSearch(entries, "  WALL  ", (key) => ({ settingsWallpaper: "Wallpaper" } as Record<string, string>)[key] ?? key)).toEqual([["appearance", "settingsWallpaper"]]);
  });

  it("returns no entries for an empty query and caps results", () => {
    expect(filterSettingsSearch(entries, " ", (key) => key)).toEqual([]);
    const many = Array.from({ length: 12 }, () => ["general", "settingsLanguage"] as const);
    expect(filterSettingsSearch(many, "language", (key) => key)).toHaveLength(8);
  });
});
