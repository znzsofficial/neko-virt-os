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
  const url =
    opts.url ??
    (opts.blob ? URL.createObjectURL(opts.blob) : null);
  if (!url) return null;

  const size = opts.size ?? opts.blob?.size;
  const mimeType = opts.mimeType ?? opts.blob?.type;

  let entry: DownloadEntry | null = null;
  if (opts.register !== false) {
    entry = useDownloadStore.getState().addDownload({
      name: opts.name,
      source: opts.source,
      size,
      mimeType,
      url,
    });
  }

  const link = document.createElement("a");
  link.href = url;
  link.download = opts.name;
  link.click();

  if (opts.revokeAfterMs != null && opts.revokeAfterMs >= 0) {
    window.setTimeout(() => {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
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
      const entries = [nextEntry, ...state.entries].slice(0, 24);
      persistDownloads(entries);
      return { entries };
    });
    return nextEntry;
  },
  removeDownload: (id) =>
    set((state) => {
      const removed = state.entries.find((entry) => entry.id === id);
      if (removed?.url?.startsWith("blob:")) URL.revokeObjectURL(removed.url);
      const entries = state.entries.filter((entry) => entry.id !== id);
      persistDownloads(entries);
      return { entries };
    }),
  clearDownloads: () =>
    set((state) => {
      state.entries.forEach((entry) => {
        if (entry.url?.startsWith("blob:")) URL.revokeObjectURL(entry.url);
      });
      persistDownloads([]);
      return { entries: [] };
    }),
}));
