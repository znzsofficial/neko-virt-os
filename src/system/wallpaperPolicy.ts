import type { ThemeSettings } from "../types";
import { WALLPAPERS } from "./theme";

export function getWallpaperFallbackId(
  wallpaperId: ThemeSettings["wallpaperId"],
  online: boolean,
): ThemeSettings["wallpaperId"] {
  if (online || !WALLPAPERS[wallpaperId].url) return wallpaperId;
  return "system";
}

export function preloadWallpaperImage(
  url: string,
  timeoutMs = 15_000,
  createImage: () => HTMLImageElement = () => new Image(),
): Promise<boolean> {
  return new Promise((resolve) => {
    const image = createImage();
    const timeout = window.setTimeout(() => finish(false), timeoutMs);
    const finish = (success: boolean) => {
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      resolve(success);
    };
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    image.src = url;
  });
}
