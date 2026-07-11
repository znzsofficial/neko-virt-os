import { Icon } from "@iconify-icon/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { consumeBrowserOpenUrl } from "../fileOpen";
import { useLanguageStore, type TranslationKey } from "../languageStore";

const defaultBookmarkSeed = [
  ["browserBookmarkNekoWiki", "https://wiki.nekolaska.vip", "solar:book-2-bold-duotone"],
  ["browserBookmarkNekoGames", "https://game.nekolaska.vip", "solar:gamepad-bold-duotone"],
  ["browserBookmarkSearch", "https://duckduckgo.com", "solar:magnifer-bold-duotone"],
  ["browserBookmarkMdn", "https://developer.mozilla.org", "solar:code-bold-duotone"],
  ["browserBookmarkGithub", "https://github.com", "solar:programming-bold-duotone"],
  ["browserBookmarkWikipedia", "https://wikipedia.org", "solar:book-bookmark-bold-duotone"],
] as const;

const legacyBookmarkTitleMap = new Map<string, TranslationKey>([
  ["https://wiki.nekolaska.vip", "browserBookmarkNekoWiki"],
  ["https://game.nekolaska.vip", "browserBookmarkNekoGames"],
  ["https://duckduckgo.com", "browserBookmarkSearch"],
  ["https://developer.mozilla.org", "browserBookmarkMdn"],
  ["https://github.com", "browserBookmarkGithub"],
  ["https://wikipedia.org", "browserBookmarkWikipedia"],
]);

const HOME_URL = "neko://home";
const BROWSER_SESSION_STORAGE_KEY = "neko-virt-os.browser-session.v1";
const BROWSER_RECENTS_STORAGE_KEY = "neko-virt-os.browser-recents.v1";
const BROWSER_BOOKMARKS_STORAGE_KEY = "neko-virt-os.browser-bookmarks.v1";
const BROWSER_CLOSED_TABS_STORAGE_KEY = "neko-virt-os.browser-closed-tabs.v1";

type BrowserTab = {
  id: string;
  history: string[];
  historyIndex: number;
  address: string;
  iframeLoaded: boolean;
  iframeSlow: boolean;
};

type BrowserRecentEntry = {
  title: string;
  url: string;
};

type BrowserBookmarkEntry = {
  title: string;
  url: string;
  icon?: string;
};

function createTab(initialUrl = HOME_URL): BrowserTab {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    history: [initialUrl],
    historyIndex: 0,
    address: initialUrl,
    iframeLoaded: initialUrl === HOME_URL,
    iframeSlow: false,
  };
}

function getDefaultBookmarks() {
  const t = useLanguageStore.getState().t;
  return defaultBookmarkSeed.map(([titleKey, url, icon]) => ({ title: t(titleKey), url, icon }));
}

function migrateLegacyBookmarks(entries: BrowserBookmarkEntry[]) {
  const t = useLanguageStore.getState().t;
  return entries.map((entry) => {
    const titleKey = legacyBookmarkTitleMap.get(entry.url);
    if (!titleKey) return entry;
    const normalizedTitle = entry.title.trim().toLowerCase();
    const legacyTitles = new Set([
      "neko wiki",
      "neko games",
      "search",
      "mdn",
      "github",
      "wikipedia",
      t(titleKey).trim().toLowerCase(),
    ]);
    if (!legacyTitles.has(normalizedTitle)) return entry;
    return { ...entry, title: t(titleKey) };
  });
}

function normalizeAddress(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === HOME_URL) return HOME_URL;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
}

function readBrowserSession() {
  try {
    const raw = localStorage.getItem(BROWSER_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as { tabs: BrowserTab[]; activeTabId: string };
    if (!Array.isArray(value.tabs) || !value.tabs.length) return null;
    return {
      tabs: value.tabs.map((tab) => ({
        ...tab,
        iframeLoaded: false,
        iframeSlow: false,
        history: Array.isArray(tab.history) && tab.history.length ? tab.history : [HOME_URL],
        historyIndex: typeof tab.historyIndex === "number" ? Math.max(0, Math.min(tab.historyIndex, tab.history.length - 1)) : 0,
        address: typeof tab.address === "string" ? tab.address : tab.history[tab.historyIndex] ?? HOME_URL,
      })),
      activeTabId: value.activeTabId,
    };
  } catch {
    return null;
  }
}

function readBrowserRecents(): BrowserRecentEntry[] {
  try {
    const raw = localStorage.getItem(BROWSER_RECENTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function readBrowserBookmarks(): BrowserBookmarkEntry[] {
  try {
    const raw = localStorage.getItem(BROWSER_BOOKMARKS_STORAGE_KEY);
    return raw ? migrateLegacyBookmarks(JSON.parse(raw)) : getDefaultBookmarks();
  } catch {
    return getDefaultBookmarks();
  }
}

function readClosedTabs(): BrowserTab[] {
  try {
    const raw = localStorage.getItem(BROWSER_CLOSED_TABS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function BrowserApp() {
  const t = useLanguageStore((state) => state.t);
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const [tabs, setTabs] = useState<BrowserTab[]>(() => {
    const session = readBrowserSession();
    return session?.tabs ?? [createTab()];
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const session = readBrowserSession();
    return session?.activeTabId ?? session?.tabs[0]?.id ?? createTab().id;
  });
  const [recentEntries, setRecentEntries] = useState<BrowserRecentEntry[]>(readBrowserRecents);
  const [bookmarks, setBookmarks] = useState<BrowserBookmarkEntry[]>(readBrowserBookmarks);
  const [closedTabs, setClosedTabs] = useState<BrowserTab[]>(readClosedTabs);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const currentUrl = activeTab.history[activeTab.historyIndex] ?? HOME_URL;
  const isHome = currentUrl === HOME_URL;
  const canGoBack = activeTab.historyIndex > 0;
  const canGoForward = activeTab.historyIndex < activeTab.history.length - 1;

  useEffect(() => {
    if (!tabs.length) return;
    const session = JSON.stringify({
      tabs: tabs.map(({ iframeLoaded, iframeSlow, ...tab }) => ({ ...tab, iframeLoaded: false, iframeSlow: false })),
      activeTabId,
    });
    localStorage.setItem(BROWSER_SESSION_STORAGE_KEY, session);
  }, [activeTabId, tabs]);

  useEffect(() => {
    localStorage.setItem(BROWSER_BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem(BROWSER_CLOSED_TABS_STORAGE_KEY, JSON.stringify(closedTabs.slice(0, 8)));
  }, [closedTabs]);

  useEffect(() => {
    const pendingUrl = consumeBrowserOpenUrl();
    if (!pendingUrl) return;
    const nextTab = createTab(pendingUrl);
    setTabs((current) => [...current, nextTab]);
    setActiveTabId(nextTab.id);
  }, []);

  useEffect(() => {
    if (!activeTab || isHome) return;
    setTabs((current) => current.map((tab) => tab.id === activeTab.id ? { ...tab, iframeLoaded: false, iframeSlow: false } : tab));
    const timer = window.setTimeout(() => {
      setTabs((current) => current.map((tab) => tab.id === activeTab.id ? { ...tab, iframeSlow: true } : tab));
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [activeTab?.id, currentUrl, isHome]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
        event.preventDefault();
        addressInputRef.current?.focus();
        addressInputRef.current?.select();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "t") {
        event.preventDefault();
        openTab();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "t") {
        event.preventDefault();
        reopenClosedTab();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closedTabs.length]);

  const visibleTabs = useMemo(
    () => tabs.map((tab, index) => {
      const url = tab.history[tab.historyIndex] ?? HOME_URL;
      if (url === HOME_URL) return { ...tab, title: index === 0 ? t("appBrowser") : t("browserNewTabLabel") };
      try {
        const parsed = new URL(url);
        return { ...tab, title: parsed.hostname.replace(/^www\./, "") };
      } catch {
        return { ...tab, title: t("browserNewTabLabel") };
      }
    }),
    [tabs, t],
  );

  function patchActiveTab(updater: (tab: BrowserTab) => BrowserTab) {
    setTabs((current) => current.map((tab) => tab.id === activeTabId ? updater(tab) : tab));
  }

  function navigate(value: string, mode: "current" | "new-tab" = "current") {
    const nextUrl = normalizeAddress(value);
    if (nextUrl !== HOME_URL) {
      setRecentEntries((current) => {
        const title = (() => {
          try {
            return new URL(nextUrl).hostname.replace(/^www\./, "");
          } catch {
            return nextUrl;
          }
        })();
        const nextEntries = [{ title, url: nextUrl }, ...current.filter((entry) => entry.url !== nextUrl)].slice(0, 8);
        localStorage.setItem(BROWSER_RECENTS_STORAGE_KEY, JSON.stringify(nextEntries));
        return nextEntries;
      });
    }
    if (mode === "new-tab") {
      const nextTab = createTab(nextUrl);
      setTabs((current) => [...current, nextTab]);
      setActiveTabId(nextTab.id);
      return;
    }
    patchActiveTab((tab) => ({
      ...tab,
      history: [...tab.history.slice(0, tab.historyIndex + 1), nextUrl],
      historyIndex: tab.historyIndex + 1,
      address: nextUrl,
    }));
  }

  function go(delta: number) {
    patchActiveTab((tab) => {
      const nextIndex = Math.min(Math.max(tab.historyIndex + delta, 0), tab.history.length - 1);
      return { ...tab, historyIndex: nextIndex, address: tab.history[nextIndex] ?? HOME_URL };
    });
  }

  function openTab(initialUrl = HOME_URL) {
    const nextTab = createTab(normalizeAddress(initialUrl));
    setTabs((current) => [...current, nextTab]);
    setActiveTabId(nextTab.id);
  }

  function saveCurrentBookmark() {
    if (isHome) return;
    const title = visibleTabs.find((tab) => tab.id === activeTabId)?.title ?? currentUrl;
    setBookmarks((current) => [{ title, url: currentUrl, icon: "solar:bookmark-bold-duotone" }, ...current.filter((entry) => entry.url !== currentUrl)].slice(0, 16));
  }

  function openBookmark(url: string, mode: "current" | "new-tab" = "current") {
    navigate(url, mode);
  }

  function editBookmarkTitle(url: string) {
    const bookmark = bookmarks.find((entry) => entry.url === url);
    if (!bookmark) return;
    const nextTitle = window.prompt(t("browserEditBookmark"), bookmark.title);
    if (!nextTitle || !nextTitle.trim()) return;
    setBookmarks((current) => current.map((entry) => entry.url === url ? { ...entry, title: nextTitle.trim() } : entry));
  }

  function removeBookmark(url: string) {
    setBookmarks((current) => current.filter((entry) => entry.url !== url));
  }

  function reopenClosedTab() {
    const lastClosed = closedTabs[0];
    if (!lastClosed) return;
    const restoredTab = { ...lastClosed, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, iframeLoaded: false, iframeSlow: false };
    setClosedTabs((current) => current.slice(1));
    setTabs((current) => [...current, restoredTab]);
    setActiveTabId(restoredTab.id);
  }

  function closeTab(id: string) {
    setTabs((current) => {
      const closingTab = current.find((tab) => tab.id === id);
      if (closingTab) {
        setClosedTabs((closed) => [{ ...closingTab, iframeLoaded: false, iframeSlow: false }, ...closed.filter((tab) => tab.id !== id)].slice(0, 8));
      }
      if (current.length === 1) {
        const fallback = createTab();
        setActiveTabId(fallback.id);
        return [fallback];
      }
      const nextTabs = current.filter((tab) => tab.id !== id);
      if (activeTabId === id) {
        const closedIndex = current.findIndex((tab) => tab.id === id);
        const fallback = nextTabs[Math.max(0, closedIndex - 1)] ?? nextTabs[0];
        setActiveTabId(fallback.id);
      }
      return nextTabs;
    });
  }

  function moveTab(dragId: string, targetId: string) {
    if (dragId === targetId) return;
    setTabs((current) => {
      const fromIndex = current.findIndex((tab) => tab.id === dragId);
      const toIndex = current.findIndex((tab) => tab.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return current;
      const next = current.slice();
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function reloadTab() {
    patchActiveTab((tab) => ({ ...tab, iframeLoaded: false, iframeSlow: false, history: [...tab.history] }));
  }

  return (
    <div className="browser-app">
      <div className="browser-tabbar">
        <div className="browser-tabs">
          {visibleTabs.map((tab) => (
            <div
              key={tab.id}
              className={`browser-tab${tab.id === activeTabId ? " is-active" : ""}${draggedTabId === tab.id ? " is-dragging" : ""}`}
              draggable
              onDragStart={() => setDraggedTabId(tab.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggedTabId) moveTab(draggedTabId, tab.id);
                setDraggedTabId(null);
              }}
              onDragEnd={() => setDraggedTabId(null)}
            >
              <button type="button" className="browser-tab-main" onClick={() => setActiveTabId(tab.id)}>
                <Icon icon={tab.history[tab.historyIndex] === HOME_URL ? "solar:home-2-bold-duotone" : "solar:global-bold-duotone"} width={14} height={14} />
                <span>{tab.title}</span>
              </button>
              <button type="button" className="browser-tab-close" onClick={() => closeTab(tab.id)} aria-label={t("close")}>
                ×
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="browser-tab-add" onClick={() => openTab()} aria-label={t("browserNewTabLabel")}>
          <Icon icon="solar:add-circle-bold-duotone" width={18} height={18} />
        </button>
      </div>

      <form className="browser-toolbar" onSubmit={(event) => { event.preventDefault(); navigate(activeTab.address); }}>
        <button type="button" className="browser-nav" disabled={!canGoBack} onClick={() => go(-1)}>←</button>
        <button type="button" className="browser-nav" disabled={!canGoForward} onClick={() => go(1)}>→</button>
        <button type="button" className="browser-nav" onClick={() => navigate(HOME_URL)}>⌂</button>
        <button type="button" className="browser-nav" disabled={isHome} onClick={reloadTab}>↻</button>
        <label className="browser-address">
          <Icon icon="solar:link-bold-duotone" width={16} height={16} />
          <input
            ref={addressInputRef}
            value={activeTab.address}
            onChange={(event) => patchActiveTab((tab) => ({ ...tab, address: event.target.value }))}
            placeholder={t("browserSearchPlaceholder")}
            spellCheck="false"
          />
        </label>
        <button className="button-primary" type="submit">{t("browserGo")}</button>
        <button className="button-ghost" type="button" disabled={isHome} onClick={saveCurrentBookmark}>{t("browserSaveBookmark")}</button>
        <button className="button-ghost" type="button" disabled={!closedTabs.length} onClick={reopenClosedTab}>{t("browserReopenClosedTab")}</button>
        <button className="button-ghost" type="button" disabled={isHome} onClick={() => openTab(currentUrl)}>{t("browserDuplicateTab")}</button>
        <button className="button-ghost" type="button" disabled={isHome} onClick={() => window.open(currentUrl, "_blank", "noopener,noreferrer")}>{t("browserOpenExternal")}</button>
      </form>

      <main className="browser-page">
        {isHome ? (
          <section className="browser-home">
            <div className="browser-home-hero">
              <div className="browser-orb"><Icon icon="solar:global-bold-duotone" width={48} height={48} /></div>
              <h2>{t("appBrowser")}</h2>
              <p>{t("browserHomeText")}</p>
            </div>
            <form className="browser-home-search" onSubmit={(event) => { event.preventDefault(); navigate(activeTab.address); }}>
              <Icon icon="solar:magnifer-bold-duotone" width={18} height={18} />
              <input
                value={activeTab.address === HOME_URL ? "" : activeTab.address}
                onChange={(event) => patchActiveTab((tab) => ({ ...tab, address: event.target.value }))}
                placeholder={t("browserSearchPlaceholder")}
                spellCheck="false"
              />
              <button type="submit">{t("browserSearch")}</button>
            </form>
            <div className="browser-home-header">
              <h3>{t("browserFrequent")}</h3>
              <button type="button" className="button-ghost" onClick={() => openTab()}>{t("browserNewTabLabel")}</button>
            </div>
            <div className="browser-bookmarks">
              {bookmarks.map((entry) => (
                <div key={entry.url} className="browser-bookmark-item">
                  <button type="button" className="browser-bookmark-main" onClick={() => openBookmark(entry.url)}>
                    <Icon icon={entry.icon ?? "solar:bookmark-bold-duotone"} width={22} height={22} />
                    <strong>{entry.title}</strong>
                    <span>{entry.url.replace(/^https?:\/\//, "")}</span>
                  </button>
                  <button type="button" className="browser-bookmark-edit" onClick={() => editBookmarkTitle(entry.url)} aria-label={t("browserEditBookmark")}>✎</button>
                  <button type="button" className="browser-bookmark-new-tab" onClick={() => openBookmark(entry.url, "new-tab")} aria-label={t("browserNewTabLabel")}>+</button>
                  <button type="button" className="browser-bookmark-remove" onClick={() => removeBookmark(entry.url)} aria-label={t("delete")}>×</button>
                </div>
              ))}
            </div>
            <div className="browser-home-header browser-home-recents-header">
              <h3>{t("browserRecent")}</h3>
              {recentEntries.length ? <button type="button" className="button-ghost" onClick={() => {
                setRecentEntries([]);
                localStorage.setItem(BROWSER_RECENTS_STORAGE_KEY, JSON.stringify([]));
              }}>{t("browserClearRecent")}</button> : null}
            </div>
            {recentEntries.length ? (
              <div className="browser-recents">
                {recentEntries.map((entry) => (
                  <button key={entry.url} type="button" className="browser-recent-item" onClick={() => navigate(entry.url)}>
                    <Icon icon="solar:history-bold-duotone" width={18} height={18} />
                    <span>{entry.title}</span>
                    <small>{entry.url.replace(/^https?:\/\//, "")}</small>
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : (
          <section className="browser-frame-shell">
            <iframe key={currentUrl} src={currentUrl} title={currentUrl} onLoad={() => patchActiveTab((tab) => ({ ...tab, iframeLoaded: true }))} />
            {activeTab.iframeSlow && !activeTab.iframeLoaded ? (
              <div className="browser-frame-notice">
                <Icon icon="solar:shield-warning-bold-duotone" width={34} height={34} />
                <h2>{t("browserBlocked")}</h2>
                <p>{t("browserBlockedMessage")}</p>
                <div className="toolbar-actions">
                  <button className="button-ghost" type="button" onClick={() => openTab(currentUrl)}>{t("browserDuplicateTab")}</button>
                  <button className="button-primary" type="button" onClick={() => window.open(currentUrl, "_blank", "noopener,noreferrer")}>{t("browserOpenExternal")}</button>
                </div>
              </div>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
}
