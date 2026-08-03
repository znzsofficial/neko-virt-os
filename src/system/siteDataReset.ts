export const APP_STORAGE_PREFIX = "neko-virt-os.";

export type SiteDataResetStage = "caches" | "mmdProjects" | "virtualFiles" | "preferences";

export type SiteDataResetStageResult = {
  stage: SiteDataResetStage;
  ok: boolean;
  error?: unknown;
};

export type SiteDataResetResult = {
  ok: boolean;
  stages: SiteDataResetStageResult[];
};

type SiteDataResetDependencies = {
  cacheStorage?: Pick<CacheStorage, "keys" | "delete"> | null;
  storage: Pick<Storage, "key" | "length" | "removeItem">;
  resetVirtualFiles: () => Promise<void>;
  clearMmdProjects: () => Promise<void>;
};

function getDefaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function getDefaultCacheStorage() {
  try {
    return "caches" in globalThis ? globalThis.caches : null;
  } catch {
    return null;
  }
}

export function removeOwnedLocalStorage(
  storage: Pick<Storage, "key" | "length" | "removeItem">,
  prefix = APP_STORAGE_PREFIX,
) {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
  return keys;
}

async function runStage(
  stage: SiteDataResetStage,
  action: () => Promise<void> | void,
): Promise<SiteDataResetStageResult> {
  try {
    await action();
    return { stage, ok: true };
  } catch (error) {
    return { stage, ok: false, error };
  }
}

export async function resetSiteData(
  dependencies?: Partial<SiteDataResetDependencies>,
): Promise<SiteDataResetResult> {
  const cacheStorage = dependencies && "cacheStorage" in dependencies
    ? dependencies.cacheStorage
    : getDefaultCacheStorage();
  const storage = dependencies?.storage ?? getDefaultStorage();
  const resetVirtualFiles = dependencies?.resetVirtualFiles ?? (async () => {
    const { resetVirtualFiles } = await import("../fs/virtualFs");
    await resetVirtualFiles();
  });
  const clearMmdProjects = dependencies?.clearMmdProjects ?? (async () => {
    const { clearAllMmdProjectData } = await import("../appModules/mmdStudio/mmdProjectDb");
    await clearAllMmdProjectData();
  });

  const stages = await Promise.all([
    runStage("caches", async () => {
      if (!cacheStorage) return;
      const keys = await cacheStorage.keys();
      const results = await Promise.all(keys.map((key) => cacheStorage.delete(key)));
      if (results.some((deleted) => !deleted)) throw new Error("cache-delete-failed");
    }),
    runStage("mmdProjects", clearMmdProjects),
    runStage("virtualFiles", resetVirtualFiles),
  ]);

  // Keep mounted stores and persisted preferences consistent after a partial
  // failure. Preferences are cleared only after all other stages succeed.
  if (stages.every((stage) => stage.ok)) {
    stages.push(await runStage("preferences", () => {
      if (!storage) throw new Error("local-storage-unavailable");
      removeOwnedLocalStorage(storage);
    }));
  } else {
    stages.push({ stage: "preferences", ok: false, error: new Error("prerequisite-stage-failed") });
  }

  return {
    ok: stages.every((stage) => stage.ok),
    stages,
  };
}
