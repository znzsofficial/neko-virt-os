// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadBlob, useDownloadStore } from "./downloadStore";

const DOWNLOADS_KEY = "neko-virt-os.downloads.v1";
let urlCounter = 0;
let createdUrls: string[];
const revokeMock = vi.fn((_url: string) => {});
let storageMap: Map<string, string>;

beforeEach(() => {
  storageMap = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storageMap.set(key, String(value));
    },
    removeItem: (key: string) => {
      storageMap.delete(key);
    },
    clear: () => storageMap.clear(),
  });
  useDownloadStore.setState({ entries: [] });
  createdUrls = [];
  revokeMock.mockReset();
  const stub = URL as unknown as {
    createObjectURL: (blob: Blob) => string;
    revokeObjectURL: (url: string) => void;
  };
  stub.createObjectURL = () => {
    const url = `blob:mock-${++urlCounter}`;
    createdUrls.push(url);
    return url;
  };
  stub.revokeObjectURL = revokeMock;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("downloadStore ownership transfer", () => {
  it("registers a store-owned url when given a blob and persists history without blob urls", () => {
    const entry = downloadBlob({ blob: new Blob(["hello"]), name: "a.txt", source: "test" });
    expect(entry).not.toBeNull();
    expect(entry!.url).toBe(createdUrls[0]);
    expect(useDownloadStore.getState().entries).toHaveLength(1);

    const history = JSON.parse(localStorage.getItem(DOWNLOADS_KEY)!) as Array<{ url?: string; name: string }>;
    expect(history).toHaveLength(1);
    expect(history[0].name).toBe("a.txt");
    expect(history[0].url).toBeUndefined();
  });

  it("keeps the caller's url untouched when the registered copy is removed", () => {
    const entry = downloadBlob({ blob: new Blob(["x"]), url: "blob:caller", name: "n", source: "s" });
    expect(entry!.url).not.toBe("blob:caller");
    expect(createdUrls).toContain(entry!.url);

    useDownloadStore.getState().removeDownload(entry!.id);
    expect(revokeMock).toHaveBeenCalledWith(entry!.url);
    expect(revokeMock).not.toHaveBeenCalledWith("blob:caller");
    expect(useDownloadStore.getState().entries).toHaveLength(0);
  });

  it("revokes only the evicted store-owned url when history exceeds the cap", () => {
    for (let i = 0; i < 24; i += 1) {
      downloadBlob({ blob: new Blob(["x"]), name: `f${i}`, source: "s" });
    }
    expect(useDownloadStore.getState().entries).toHaveLength(24);

    downloadBlob({ blob: new Blob(["y"]), name: "f24", source: "s" });
    expect(useDownloadStore.getState().entries).toHaveLength(24);
    expect(revokeMock).toHaveBeenCalledTimes(1);
    expect(revokeMock).toHaveBeenCalledWith(createdUrls[0]);
    expect(revokeMock).not.toHaveBeenCalledWith(createdUrls[23]);
    expect(revokeMock).not.toHaveBeenCalledWith(createdUrls[24]);
  });

  it("clearDownloads revokes every owned url", () => {
    const first = downloadBlob({ blob: new Blob(["x"]), name: "n1", source: "s" });
    const second = downloadBlob({ blob: new Blob(["y"]), name: "n2", source: "s" });
    useDownloadStore.getState().clearDownloads();
    expect(revokeMock).toHaveBeenCalledWith(first!.url);
    expect(revokeMock).toHaveBeenCalledWith(second!.url);
    expect(useDownloadStore.getState().entries).toHaveLength(0);
  });

  it("skips history registration when register is false", () => {
    const entry = downloadBlob({ blob: new Blob(["x"]), name: "n", source: "s", register: false });
    expect(entry).toBeNull();
    expect(useDownloadStore.getState().entries).toHaveLength(0);
    expect(localStorage.getItem(DOWNLOADS_KEY)).toBeNull();
  });

  it("adopts a store-owned url for caller blob urls after the download starts", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, blob: async () => new Blob(["x"]) })));
    const entry = downloadBlob({ url: "blob:caller", name: "n", source: "s" });
    expect(entry!.url).toBe("blob:caller");

    await vi.waitFor(() => {
      expect(useDownloadStore.getState().entries[0]?.url).not.toBe("blob:caller");
    });
    expect(createdUrls).toContain(useDownloadStore.getState().entries[0]!.url);
    expect(revokeMock).not.toHaveBeenCalledWith("blob:caller");
  });

  it("keeps the caller url when the store copy cannot be fetched", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("adopt failed");
    }));
    const entry = downloadBlob({ url: "blob:caller", name: "n", source: "s" });
    expect(entry!.url).toBe("blob:caller");

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(useDownloadStore.getState().entries[0]?.url).toBe("blob:caller");
    expect(createdUrls).toHaveLength(0);
    expect(revokeMock).not.toHaveBeenCalled();
  });
});
