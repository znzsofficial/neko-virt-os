import type { BrowserSearchEngine } from "./storage";

/** Shared browser home pseudo-URL (2D BrowserApp + VR browser). */
export const BROWSER_HOME_URL = "neko://home";

export const SEARCH_ENGINE_URLS: Record<BrowserSearchEngine, string> = {
  duckduckgo: "https://duckduckgo.com/?q=",
  google: "https://www.google.com/search?q=",
  bing: "https://www.bing.com/search?q=",
};

/**
 * Normalize user input to a navigable URL or home.
 * Used by 2D BrowserApp and VR browser panels.
 */
export function normalizeBrowserUrl(
  value: string,
  homeUrl = BROWSER_HOME_URL,
  searchEngine: BrowserSearchEngine = "duckduckgo",
): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === homeUrl) return homeUrl;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.username || url.password) {
        url.username = "";
        url.password = "";
        return url.toString();
      }
    } catch {
      return trimmed;
    }
    return trimmed;
  }
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return `${SEARCH_ENGINE_URLS[searchEngine]}${encodeURIComponent(trimmed)}`;
}

export function isBrowserHome(url: string, homeUrl = BROWSER_HOME_URL): boolean {
  return !url || url === homeUrl;
}

/** Hostname for display; `homeLabel` when on home. */
export function shortBrowserHost(
  url: string,
  homeLabel: string,
  homeUrl = BROWSER_HOME_URL,
): string {
  if (isBrowserHome(url, homeUrl)) return homeLabel;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 28);
  }
}
