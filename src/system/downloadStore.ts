import { create } from "zustand";
import { setOwnedLocalStorageItem } from "./persistenceGate";

export type DownloadEntry = {
  id: string;
  name: string;
  source: string;
  size?: number;
  mimeType?: string;
  createdAt: number;
  url?: string;
};

type DownloadHistoryEntry = Omit<DownloadEntry, "url">;

type DownloadStore = {
  entries: DownloadEntry[];
  addDownload: (entry: Omit<DownloadEntry, "id" | "createdAt">) => DownloadEntry;
  removeDownload: (id: string) => void;
  clearDownloads: () => void;
};

const DOWNLOADS_STORAGE_KEY = "neko-virt-os.downloads.v1";
const MAX_DOWNLOADS = 24;

const ownedBlobUrls = new Set<string>();

function revokeIfOwned(url: string | undefined) {
  if (!url?.startsWith("blob:") || !ownedBlobUrls.has(url)) return;
  ownedBlobUrls.delete(url);
  URL.revokeObjectURL(url);
}

function readDownloads(): DownloadEntry[] {
  try {
    const raw = localStorage.getItem(DOWNLOADS_STORAGE_KEY);
    const history = raw ? (JSON.parse(raw) as DownloadHistoryEntry[]) : [];
    return Array.isArray(history) ? history.map((entry) => ({ ...entry, url: undefined })) : [];
  } catch {
    return [];
  }
}

function persistDownloads(entries: DownloadEntry[]) {
  const history: DownloadHistoryEntry[] = entries.map(({ url: _url, ...entry }) => entry);
  try {
    setOwnedLocalStorageItem(DOWNLOADS_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // ignore
  }
}

async function adoptStoreOwnedUrl(entryId: string, sharedUrl: string) {
  try {
    const response = await fetch(sharedUrl);
    if (!response.ok) return;
    const ownedUrl = URL.createObjectURL(await response.blob());
    if (!useDownloadStore.getState().entries.some((entry) => entry.id === entryId)) {
      URL.revokeObjectURL(ownedUrl);
      return;
    }
    const previous = useDownloadStore.getState().entries.find((entry) => entry.id === entryId)?.url;
    ownedBlobUrls.add(ownedUrl);
    useDownloadStore.setState((state) => ({
      entries: state.entries.map((entry) => (entry.id === entryId ? { ...entry, url: ownedUrl } : entry)),
    }));
    revokeIfOwned(previous);
  } catch {
    // Keep sharing the caller URL when the copy fails.
  }
}

export type DownloadBlobOptions = {
  blob?: Blob;
  /** Existing object URL (e.g. recorder preview). When set, blob is optional. */
  url?: string;
  name: string;
  source: string;
  mimeType?: string;
  size?: number;
  /** Register in Downloads app history (default true). */
  register?: boolean;
  /** Revoke object URL after trigger (default false when register keeps url). */
  revokeAfterMs?: number;
};

/**
 * Trigger browser download; optionally register in Downloads history.
 * Prefer this over hand-rolled createObjectURL + <a click>.
 */
export function downloadBlob(opts: DownloadBlobOptions): DownloadEntry | null {
  const callerUrl = opts.url ?? null;
  const url = callerUrl ?? (opts.blob ? URL.createObjectURL(opts.blob) : null);
  if (!url) return null;

  const size = opts.size ?? opts.blob?.size;
  const mimeType = opts.mimeType ?? opts.blob?.type;

  let entry: DownloadEntry | null = null;
  if (opts.register !== false) {
    const ownedUrl = opts.blob ? (callerUrl ? URL.createObjectURL(opts.blob) : url) : null;
    entry = useDownloadStore.getState().addDownload({
      name: opts.name,
      source: opts.source,
      size,
      mimeType,
      url: ownedUrl ?? url,
    });
    if (ownedUrl) ownedBlobUrls.add(ownedUrl);
    else if (callerUrl?.startsWith("blob:")) void adoptStoreOwnedUrl(entry.id, callerUrl);
  }

  const link = document.createElement("a");
  link.href = url;
  link.download = opts.name;
  link.click();

  if (opts.revokeAfterMs != null && opts.revokeAfterMs >= 0) {
    window.setTimeout(() => {
      if (url.startsWith("blob:")) {
        ownedBlobUrls.delete(url);
        URL.revokeObjectURL(url);
      }
    }, opts.revokeAfterMs);
  }

  return entry;
}

export const useDownloadStore = create<DownloadStore>((set) => ({
  entries: readDownloads(),
  addDownload: (entry) => {
    const nextEntry: DownloadEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: Date.now(),
    };
    set((state) => {
      const merged = [nextEntry, ...state.entries];
      for (const evicted of merged.slice(MAX_DOWNLOADS)) revokeIfOwned(evicted.url);
      const entries = merged.slice(0, MAX_DOWNLOADS);
      persistDownloads(entries);
      return { entries };
    });
    return nextEntry;
  },
  removeDownload: (id) =>
    set((state) => {
      const removed = state.entries.find((entry) => entry.id === id);
      if (removed) revokeIfOwned(removed.url);
      const entries = state.entries.filter((entry) => entry.id !== id);
      persistDownloads(entries);
      return { entries };
    }),
  clearDownloads: () =>
    set((state) => {
      state.entries.forEach((entry) => {
        revokeIfOwned(entry.url);
      });
      persistDownloads([]);
      return { entries: [] };
    }),
}));
