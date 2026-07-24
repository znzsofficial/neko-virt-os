/**
 * Default bookmark catalog shared by 2D Browser and VR browser.
 * Titles: 2D resolves via i18n keys; VR may use titleZh/titleEn.
 */
export type BrowserBookmarkSeed = {
  id: string;
  /** languageStore key for 2D UI */
  titleKey: string;
  titleZh: string;
  titleEn: string;
  url: string;
  icon: string;
};

/**
 * Default catalog for 2D + VR.
 * Prefer sites that often allow iframe embedding when possible (many major sites block it).
 */
export const DEFAULT_BROWSER_BOOKMARKS: readonly BrowserBookmarkSeed[] = [
  {
    id: "wiki",
    titleKey: "browserBookmarkNekoWiki",
    titleZh: "Neko Wiki",
    titleEn: "Neko Wiki",
    url: "https://wiki.nekolaska.vip",
    icon: "solar:book-2-bold-duotone",
  },
  {
    id: "games",
    titleKey: "browserBookmarkNekoGames",
    titleZh: "Neko Games",
    titleEn: "Neko Games",
    url: "https://game.nekolaska.vip",
    icon: "solar:gamepad-bold-duotone",
  },
  {
    id: "example",
    titleKey: "browserBookmarkExample",
    titleZh: "Example",
    titleEn: "Example",
    url: "https://example.com",
    icon: "solar:global-bold-duotone",
  },
  {
    id: "search",
    titleKey: "browserBookmarkSearch",
    titleZh: "搜索",
    titleEn: "Search",
    // Lite HTML is more embed-friendly than the main SPA shell.
    url: "https://html.duckduckgo.com/html/",
    icon: "solar:magnifer-bold-duotone",
  },
  {
    id: "wikipedia",
    titleKey: "browserBookmarkWikipedia",
    titleZh: "维基",
    titleEn: "Wikipedia",
    url: "https://en.m.wikipedia.org",
    icon: "solar:book-bookmark-bold-duotone",
  },
  {
    id: "mdn",
    titleKey: "browserBookmarkMdn",
    titleZh: "MDN",
    titleEn: "MDN",
    url: "https://developer.mozilla.org",
    icon: "solar:code-bold-duotone",
  },
] as const;

/** url → titleKey for migrating legacy English bookmark titles in 2D storage. */
export const LEGACY_BOOKMARK_TITLE_BY_URL: ReadonlyMap<string, string> = new Map(
  DEFAULT_BROWSER_BOOKMARKS.map((b) => [b.url, b.titleKey]),
);

/**
 * Lowercase title aliases treated as auto-generated defaults when migrating
 * stored bookmarks (old English labels before i18n keys).
 */
export const LEGACY_BOOKMARK_TITLE_ALIASES: readonly string[] = [
  "neko wiki",
  "neko games",
  "search",
  "mdn",
  "github",
  "wikipedia",
];
