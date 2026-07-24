/**
 * VR browser helpers — thin adapters over shared browser domain.
 */
import {
  BROWSER_HOME_URL,
  DEFAULT_BROWSER_BOOKMARKS,
  isBrowserHome,
  normalizeBrowserUrl,
  shortBrowserHost,
} from "../shared";

export const VR_BROWSER_HOME = BROWSER_HOME_URL;

export type VrBrowserBookmark = {
  id: string;
  titleZh: string;
  titleEn: string;
  url: string;
};

export const VR_BROWSER_BOOKMARKS: VrBrowserBookmark[] = DEFAULT_BROWSER_BOOKMARKS.map((b) => ({
  id: b.id,
  titleZh: b.titleZh,
  titleEn: b.titleEn,
  url: b.url,
}));

export function normalizeVrBrowserUrl(value: string): string {
  return normalizeBrowserUrl(value, VR_BROWSER_HOME);
}

export function isVrBrowserHome(url: string): boolean {
  return isBrowserHome(url, VR_BROWSER_HOME);
}

export function shortVrBrowserHost(url: string, language: "zh" | "en"): string {
  return shortBrowserHost(url, language === "zh" ? "主页" : "Home", VR_BROWSER_HOME);
}
