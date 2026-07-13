import { create } from "zustand";

type FilesBridgeHandlers = {
  startCreateFile: (() => void) | null;
  createFolder: (() => void | Promise<void>) | null;
  openFolder: ((folderId: string | null) => void) | null;
};

type FilesBridgeStore = FilesBridgeHandlers & {
  /** Atomically replace live handlers (no null gap on re-render). */
  setHandlers: (handlers: Partial<FilesBridgeHandlers>) => void;
  clearHandlers: () => void;
};

export const useFilesBridgeStore = create<FilesBridgeStore>((set) => ({
  startCreateFile: null,
  createFolder: null,
  openFolder: null,
  setHandlers: (handlers) => set((state) => ({ ...state, ...handlers })),
  clearHandlers: () =>
    set({
      startCreateFile: null,
      createFolder: null,
      openFolder: null,
    }),
}));

export function openFilesFolder(folderId: string | null) {
  useFilesBridgeStore.getState().openFolder?.(folderId);
}

export function startFilesCreateFile() {
  useFilesBridgeStore.getState().startCreateFile?.();
}

export function startFilesCreateFolder() {
  return useFilesBridgeStore.getState().createFolder?.();
}
