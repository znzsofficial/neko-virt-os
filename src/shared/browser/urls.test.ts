import { describe, expect, it } from "vitest";
import { BROWSER_HOME_URL, isBrowserHome, normalizeBrowserUrl, shortBrowserHost } from "./urls";

describe("normalizeBrowserUrl", () => {
  it("maps empty and home to home", () => {
    expect(normalizeBrowserUrl("")).toBe(BROWSER_HOME_URL);
    expect(normalizeBrowserUrl("  ")).toBe(BROWSER_HOME_URL);
    expect(normalizeBrowserUrl(BROWSER_HOME_URL)).toBe(BROWSER_HOME_URL);
  });

  it("keeps http(s) urls", () => {
    expect(normalizeBrowserUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(normalizeBrowserUrl("http://example.com")).toBe("http://example.com");
  });

  it("prefixes bare hosts", () => {
    expect(normalizeBrowserUrl("example.com")).toBe("https://example.com");
    expect(normalizeBrowserUrl("wiki.nekolaska.vip/path")).toBe("https://wiki.nekolaska.vip/path");
  });

  it("searches free text", () => {
    expect(normalizeBrowserUrl("hello world")).toBe(
      "https://duckduckgo.com/?q=hello%20world",
    );
  });
});

describe("isBrowserHome / shortBrowserHost", () => {
  it("detects home", () => {
    expect(isBrowserHome("")).toBe(true);
    expect(isBrowserHome(BROWSER_HOME_URL)).toBe(true);
    expect(isBrowserHome("https://a.com")).toBe(false);
  });

  it("formats host labels", () => {
    expect(shortBrowserHost(BROWSER_HOME_URL, "Home")).toBe("Home");
    expect(shortBrowserHost("https://www.example.com/x", "Home")).toBe("example.com");
  });
});
