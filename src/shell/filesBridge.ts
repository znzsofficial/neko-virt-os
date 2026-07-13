type FilesBridgeHandlers = {
  startCreateFile: (() => void) | null;
  createFolder: (() => void | Promise<void>) | null;
  openFolder: ((folderId: string | null) => void) | null;
};

const emptyHandlers: FilesBridgeHandlers = {
  startCreateFile: null,
  createFolder: null,
  openFolder: null,
};

/** Live refs — updated without React re-renders / Zustand churn. */
let liveHandlers: FilesBridgeHandlers = { ...emptyHandlers };

/**
 * Register Files app bridge handlers. Call from an effect with stable callbacks.
 * Cleanup clears only if the same handler instances are still live.
 */
export function registerFilesBridgeHandlers(handlers: {
  startCreateFile: () => void;
  createFolder: () => void | Promise<void>;
  openFolder: (folderId: string | null) => void;
}) {
  liveHandlers = {
    startCreateFile: handlers.startCreateFile,
    createFolder: handlers.createFolder,
    openFolder: handlers.openFolder,
  };
  return () => {
    if (
      liveHandlers.startCreateFile === handlers.startCreateFile
      && liveHandlers.createFolder === handlers.createFolder
      && liveHandlers.openFolder === handlers.openFolder
    ) {
      liveHandlers = { ...emptyHandlers };
    }
  };
}

export function openFilesFolder(folderId: string | null) {
  liveHandlers.openFolder?.(folderId);
}

export function startFilesCreateFile() {
  liveHandlers.startCreateFile?.();
}

export function startFilesCreateFolder() {
  return liveHandlers.createFolder?.();
}

/** Test / diagnostics helper. */
export function getFilesBridgeHandlersForTest() {
  return liveHandlers;
}

/** Test helper: force-clear bridge. */
export function clearFilesBridgeHandlersForTest() {
  liveHandlers = { ...emptyHandlers };
}
