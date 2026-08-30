// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_THEME_SETTINGS, WALLPAPERS } from "../../../system/theme";
import type { ThemeSettings } from "../../../types";
import type { TranslationKey } from "../../../languageStore";
import { AppearanceSettings } from "./AppearanceSettings";

type WallpaperEntry = [ThemeSettings["wallpaperId"], (typeof WALLPAPERS)[ThemeSettings["wallpaperId"]]];

const wallpaperGroups = {
  wallpaperCategoryNature: [["alpine-lake", WALLPAPERS["alpine-lake"]]],
} as unknown as Record<string, WallpaperEntry[]>;

const themeSettings: ThemeSettings = {
  ...DEFAULT_THEME_SETTINGS,
  wallpaperLightId: "system",
  wallpaperDarkId: "system",
};

const t = (key: TranslationKey) => key;

describe("AppearanceSettings", () => {
  it("keeps wallpaper controls rendered and invokes the selected slot", () => {
    const setWallpaper = vi.fn();

    render(
      <AppearanceSettings
        t={t}
        themeSettings={themeSettings}
        setThemeSettings={vi.fn()}
        updateThemeSettings={(patch) => ({ ...themeSettings, ...patch })}
        wallpaperGroups={wallpaperGroups}
        wallpaperBusy={null}
        setWallpaper={setWallpaper}
        syncWallpapers={vi.fn()}
        randomizeWallpaper={vi.fn()}
      />,
    );

    const radios = screen.getAllByRole("radio", { name: "wallpaperAlpineLake" });
    expect(radios).toHaveLength(2);
    expect(radios[0].closest(".wallpaper-option")).toHaveClass("wallpaper-option");

    fireEvent.click(radios[0]);

    expect(setWallpaper).toHaveBeenCalledWith("light", "alpine-lake");
    expect(screen.getByRole("heading", { name: "settingsNavAppearance" })).toBeInTheDocument();
  });
});
