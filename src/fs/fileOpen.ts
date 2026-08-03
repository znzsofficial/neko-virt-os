import type { AppId } from "../apps";
import { removeOwnedLocalStorageItem, setOwnedLocalStorageItem } from "../system/persistenceGate";
import type { FsFile } from "./virtualFs";

const BROWSER_PENDING_URL_KEY = "neko-virt-os.browser-pending-url.v1";

export function getFileOpenApp(file: Pick<FsFile, "name" | "kind">): AppId {
  if (file.kind === "folder") return "files";
  const lower = file.name.toLowerCase();
  // Text-like content is edited in Notes; other kinds still fall back there as the only document surface.
  if (
    lower.endsWith(".md")
    || lower.endsWith(".markdown")
    || lower.endsWith(".txt")
    || lower.endsWith(".log")
    || lower.endsWith(".csv")
    || lower.endsWith(".json")
    || lower.endsWith(".ts")
    || lower.endsWith(".tsx")
    || lower.endsWith(".js")
    || lower.endsWith(".jsx")
    || lower.endsWith(".css")
    || lower.endsWith(".html")
    || lower.endsWith(".xml")
    || lower.endsWith(".yml")
    || lower.endsWith(".yaml")
  ) {
    return "notes";
  }
  return "notes";
}

export function getFileOpenLabelKey(file: Pick<FsFile, "name" | "kind">): "openFolder" | "openInNotes" | "open" {
  if (file.kind === "folder") return "openFolder";
  return "openInNotes";
}

export function queueBrowserOpenUrl(url: string) {
  try {
    setOwnedLocalStorageItem(BROWSER_PENDING_URL_KEY, url);
  } catch {
    // ignore quota / privacy mode failures
  }
}

export function consumeBrowserOpenUrl() {
  try {
    const url = localStorage.getItem(BROWSER_PENDING_URL_KEY);
    if (!url) return null;
    removeOwnedLocalStorageItem(BROWSER_PENDING_URL_KEY);
    return url;
  } catch {
    return null;
  }
}
