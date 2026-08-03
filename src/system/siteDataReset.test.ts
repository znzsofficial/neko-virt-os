import { describe, expect, it, vi } from "vitest";
import {
  APP_STORAGE_PREFIX,
  APP_CACHE_PREFIX,
  removeOwnedCaches,
  removeOwnedLocalStorage,
  resetSiteData,
  type SiteDataResetStage,
} from "./siteDataReset";

function createStorage(entries: Record<string, string>) {
  const data = new Map(Object.entries(entries));
  return {
    get length() {
      return data.size;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    has(key: string) {
      return data.has(key);
    },
  };
}

describe("removeOwnedLocalStorage", () => {
  it("removes only application-owned keys", () => {
    const storage = createStorage({
      [`${APP_STORAGE_PREFIX}theme.v2`]: "{}",
      [`${APP_STORAGE_PREFIX}workspace.v1`]: "1",
      "another-app.token": "keep",
    });

    const removed = removeOwnedLocalStorage(storage);

    expect(removed).toHaveLength(2);
    expect(storage.has("another-app.token")).toBe(true);
    expect(storage.has(`${APP_STORAGE_PREFIX}theme.v2`)).toBe(false);
  });
});

describe("removeOwnedCaches", () => {
  it("deletes only application-owned cache buckets", async () => {
    const cacheStorage = {
      keys: vi.fn().mockResolvedValue([`${APP_CACHE_PREFIX}shell-v1`, "another-app-cache"]),
      delete: vi.fn().mockResolvedValue(true),
    };

    await expect(removeOwnedCaches(cacheStorage)).resolves.toEqual([`${APP_CACHE_PREFIX}shell-v1`]);
    expect(cacheStorage.delete).toHaveBeenCalledWith(`${APP_CACHE_PREFIX}shell-v1`);
    expect(cacheStorage.delete).not.toHaveBeenCalledWith("another-app-cache");
  });
});

describe("resetSiteData", () => {
  it("clears every declared data stage", async () => {
    const storage = createStorage({ [`${APP_STORAGE_PREFIX}theme.v2`]: "{}" });
    const resetVirtualFiles = vi.fn().mockResolvedValue(undefined);
    const clearMmdProjects = vi.fn().mockResolvedValue(undefined);
    const cacheStorage = {
      keys: vi.fn().mockResolvedValue([`${APP_CACHE_PREFIX}shell`, `${APP_CACHE_PREFIX}images`, "shared"]),
      delete: vi.fn().mockResolvedValue(true),
    };

    const result = await resetSiteData({ storage, resetVirtualFiles, clearMmdProjects, cacheStorage });

    expect(result.ok).toBe(true);
    expect(result.stages.map(({ stage }) => stage)).toEqual([
      "caches",
      "mmdProjects",
      "virtualFiles",
      "preferences",
    ] satisfies SiteDataResetStage[]);
    expect(cacheStorage.delete).toHaveBeenCalledTimes(2);
    expect(clearMmdProjects).toHaveBeenCalledOnce();
    expect(resetVirtualFiles).toHaveBeenCalledOnce();
    expect(storage.length).toBe(0);
  });

  it("continues after a stage fails and reports partial failure", async () => {
    const storage = createStorage({
      [`${APP_STORAGE_PREFIX}theme.v2`]: "{}",
      "another-app.token": "keep",
    });
    const resetVirtualFiles = vi.fn().mockRejectedValue(new Error("filesystem unavailable"));
    const clearMmdProjects = vi.fn().mockResolvedValue(undefined);

    const result = await resetSiteData({
      storage,
      resetVirtualFiles,
      clearMmdProjects,
      cacheStorage: null,
    });

    expect(result.ok).toBe(false);
    expect(result.stages.find(({ stage }) => stage === "virtualFiles")?.ok).toBe(false);
    expect(result.stages.find(({ stage }) => stage === "preferences")?.ok).toBe(false);
    expect(storage.has(`${APP_STORAGE_PREFIX}theme.v2`)).toBe(true);
    expect(clearMmdProjects).toHaveBeenCalledOnce();
    expect(storage.has("another-app.token")).toBe(true);
  });
});
