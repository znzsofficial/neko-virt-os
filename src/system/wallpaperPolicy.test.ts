// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { getWallpaperFallbackId, getWallpaperThumbnailUrl, preloadWallpaperImage } from "./wallpaperPolicy";

afterEach(() => vi.useRealTimers());

describe("wallpaper policy", () => {
  it("keeps remote wallpapers online and falls back offline", () => {
    expect(getWallpaperFallbackId("forest", true)).toBe("forest");
    expect(getWallpaperFallbackId("forest", false)).toBe("system");
  });

  it("keeps the built-in wallpaper available offline", () => {
    expect(getWallpaperFallbackId("system", false)).toBe("system");
  });

  it("uses a lightweight preview without changing the desktop URL", () => {
    const source = "https://images.unsplash.com/photo-test?auto=format&fit=crop&w=2400&q=85";
    const thumbnail = new URL(getWallpaperThumbnailUrl(source));

    expect(thumbnail.searchParams.get("w")).toBe("480");
    expect(thumbnail.searchParams.get("q")).toBe("70");
    expect(source).toContain("w=2400");
  });

  it("times out a stalled remote wallpaper request", async () => {
    vi.useFakeTimers();
    const image = {} as HTMLImageElement;
    const pending = preloadWallpaperImage("https://example.test/wallpaper.jpg", 100, () => image);

    await vi.advanceTimersByTimeAsync(100);

    await expect(pending).resolves.toBe(false);
    expect(image.onload).toBeNull();
    expect(image.onerror).toBeNull();
  });
});
