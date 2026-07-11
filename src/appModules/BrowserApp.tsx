import { Icon } from "@iconify-icon/react";
import { useEffect, useState } from "react";
import { useLanguageStore } from "../languageStore";

const bookmarks = [
  ["Neko Wiki", "https://wiki.nekolaska.vip", "solar:book-2-bold-duotone"],
  ["Neko Games", "https://game.nekolaska.vip", "solar:gamepad-bold-duotone"],
  ["Search", "https://duckduckgo.com"],
  ["MDN", "https://developer.mozilla.org"],
  ["GitHub", "https://github.com"],
  ["Wikipedia", "https://wikipedia.org"],
] as const;

export function BrowserApp() {
  const t = useLanguageStore((state) => state.t);
  const [history, setHistory] = useState<string[]>(["neko://home"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [address, setAddress] = useState("neko://home");
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeSlow, setIframeSlow] = useState(false);
  const currentUrl = history[historyIndex] ?? "neko://home";
  const isHome = currentUrl === "neko://home";

  useEffect(() => {
    if (isHome) return;
    setIframeLoaded(false);
    setIframeSlow(false);
    const timer = window.setTimeout(() => setIframeSlow(true), 2600);
    return () => window.clearTimeout(timer);
  }, [currentUrl, isHome]);

  function normalizeAddress(value: string) {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "neko://home") return "neko://home";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }

  function navigate(value: string) {
    const nextUrl = normalizeAddress(value);
    setHistory((current) => [...current.slice(0, historyIndex + 1), nextUrl]);
    setHistoryIndex((current) => current + 1);
    setAddress(nextUrl);
  }

  function go(delta: number) {
    setHistoryIndex((current) => {
      const next = Math.min(Math.max(current + delta, 0), history.length - 1);
      setAddress(history[next] ?? "neko://home");
      return next;
    });
  }

  return (
    <div className="browser-app">
      <form className="browser-toolbar" onSubmit={(event) => { event.preventDefault(); navigate(address); }}>
        <button type="button" className="browser-nav" disabled={historyIndex === 0} onClick={() => go(-1)}>←</button>
        <button type="button" className="browser-nav" disabled={historyIndex >= history.length - 1} onClick={() => go(1)}>→</button>
        <button type="button" className="browser-nav" onClick={() => navigate("neko://home")}>⌂</button>
        <label className="browser-address">
          <Icon icon="solar:link-bold-duotone" width={16} height={16} />
          <input value={address} onChange={(event) => setAddress(event.target.value)} spellCheck="false" />
        </label>
        <button className="button-primary" type="submit">{t("browserGo")}</button>
        <button className="button-ghost" type="button" disabled={isHome} onClick={() => window.open(currentUrl, "_blank", "noopener,noreferrer")}>{t("browserOpen")}</button>
      </form>
      <main className="browser-page">
        {isHome ? (
          <section className="browser-home">
            <div className="browser-home-hero">
              <div className="browser-orb"><Icon icon="solar:global-bold-duotone" width={48} height={48} /></div>
              <h2>{t("appBrowser")}</h2>
              <p>{t("browserHomeText")}</p>
            </div>
            <form className="browser-home-search" onSubmit={(event) => { event.preventDefault(); navigate(address); }}>
              <Icon icon="solar:magnifer-bold-duotone" width={18} height={18} />
              <input value={address === "neko://home" ? "" : address} onChange={(event) => setAddress(event.target.value)} placeholder={t("browserSearchPlaceholder")} spellCheck="false" />
              <button type="submit">{t("browserSearch")}</button>
            </form>
            <h3>{t("browserFrequent")}</h3>
            <div className="browser-bookmarks">
              {bookmarks.map(([label, url, icon]) => (
                <button key={url} onClick={() => navigate(url)}>
                  <Icon icon={icon ?? "solar:bookmark-bold-duotone"} width={22} height={22} />
                  <strong>{label}</strong>
                  <span>{url.replace(/^https?:\/\//, "")}</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="browser-frame-shell">
            <iframe key={currentUrl} src={currentUrl} title={currentUrl} onLoad={() => setIframeLoaded(true)} />
            {iframeSlow && !iframeLoaded ? (
              <div className="browser-frame-notice">
                <Icon icon="solar:shield-warning-bold-duotone" width={34} height={34} />
                <h2>{t("browserBlocked")}</h2>
                <p>{currentUrl}</p>
                <button className="button-primary" onClick={() => window.open(currentUrl, "_blank", "noopener,noreferrer")}>{t("browserExternal")}</button>
              </div>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
}
