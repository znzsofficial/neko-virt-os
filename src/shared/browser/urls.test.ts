import { describe, expect, it } from "vitest";
import { BROWSER_HOME_URL, normalizeBrowserUrl, shortBrowserHost } from "./urls";

describe("normalizeBrowserUrl", () => {
  it("strips userinfo credentials from http(s) urls", () => {
    const result = normalizeBrowserUrl("https://user:pass@example.com/path?q=1");
    expect(result).not.toContain("user:pass");
    const parsed = new URL(result);
    expect(parsed.username).toBe("");
    expect(parsed.password).toBe("");
    expect(parsed.hostname).toBe("example.com");
    expect(parsed.pathname).toBe("/path");
  });

  it("strips userinfo from root-path urls and keeps the trailing slash", () => {
    expect(normalizeBrowserUrl("https://u@example.com")).toBe("https://example.com/");
  });

  it("keeps credential-free urls byte-identical", () => {
    expect(normalizeBrowserUrl("https://example.com/path")).toBe("https://example.com/path");
  });

  it("leaves home and empty input on home", () => {
    expect(normalizeBrowserUrl("")).toBe(BROWSER_HOME_URL);
    expect(normalizeBrowserUrl(BROWSER_HOME_URL)).toBe(BROWSER_HOME_URL);
  });

  it("prefixes bare domains with https", () => {
    expect(normalizeBrowserUrl("example.com")).toBe("https://example.com");
    expect(normalizeBrowserUrl("example.com/x")).toBe("https://example.com/x");
  });

  it("routes non-url input through the search engine", () => {
    expect(normalizeBrowserUrl("neko cat")).toBe("https://duckduckgo.com/?q=neko%20cat");
  });

  it("never returns javascript: or data: payloads as navigable urls", () => {
    const js = normalizeBrowserUrl("javascript:alert(1)");
    expect(js.startsWith("http")).toBe(true);
    expect(js).toContain(encodeURIComponent("javascript:alert(1)"));
    const data = normalizeBrowserUrl("data:text/html,<script>alert(1)</script>");
    expect(data.startsWith("http")).toBe(true);
    expect(data).not.toContain("<script>");
  });
});

describe("shortBrowserHost", () => {
  it("shows the home label on home", () => {
    expect(shortBrowserHost(BROWSER_HOME_URL, "主页")).toBe("主页");
    expect(shortBrowserHost("", "主页")).toBe("主页");
  });

  it("strips www from display hosts", () => {
    expect(shortBrowserHost("https://www.example.com/a", "主页")).toBe("example.com");
  });
});
