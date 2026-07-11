import { create } from "zustand";

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
    return history.map((entry) => ({ ...entry, url: undefined }));
  } catch {
    return [];
  }
}

function persistDownloads(entries: DownloadEntry[]) {
  const history: DownloadHistoryEntry[] = entries.map(({ url: _url, ...entry }) => entry);
  localStorage.setItem(DOWNLOADS_STORAGE_KEY, JSON.stringify(history));
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
