import { useLanguageStore } from "./languageStore";
import { useMmdStudioStore } from "./appModules/mmdStudio/mmdStudioStore";
import type { WindowState } from "./types";

export function setNoteWindowDirty(windowId: string, dirty: boolean) {
  const registry = ((globalThis as any).__notes_dirty_windows ??= {}) as Record<string, boolean>;
  registry[windowId] = dirty;
}

export function setNoteWindowFile(windowId: string, fileId: string) {
  const registry = ((globalThis as any).__notes_window_files ??= {}) as Record<string, string>;
  registry[windowId] = fileId;
}

export function getNoteWindowFile(windowId: string) {
  const registry = ((globalThis as any).__notes_window_files ?? {}) as Record<string, string>;
  return registry[windowId] ?? null;
}

export function clearNoteWindowDirty(windowId: string) {
  const registry = ((globalThis as any).__notes_dirty_windows ??= {}) as Record<string, boolean>;
  delete registry[windowId];
}

export function clearNoteWindowFile(windowId: string) {
  const registry = ((globalThis as any).__notes_window_files ??= {}) as Record<string, string>;
  delete registry[windowId];
}

export function isNoteWindowDirty(windowId: string) {
  const registry = ((globalThis as any).__notes_dirty_windows ?? {}) as Record<string, boolean>;
  return Boolean(registry[windowId]);
}

function mmdStudioNeedsCloseConfirm() {
  try {
    const state = useMmdStudioStore.getState();
    return state.models.length > 0 || state.recording || state.exportingOffline;
  } catch {
    return true;
  }
}

export function requestCloseWindow(windowState: WindowState, closeWindow: (id: string) => void) {
  const t = useLanguageStore.getState().t;
  if (windowState.appId === "notes" && isNoteWindowDirty(windowState.id)) {
    const shouldClose = window.confirm(t("confirmUnsavedNotes"));
    if (!shouldClose) return;
  }
  if (windowState.appId === "mmd-studio" && mmdStudioNeedsCloseConfirm()) {
    const shouldClose = window.confirm(t("confirmCloseMmdStudio"));
    if (!shouldClose) return;
  }
  clearNoteWindowDirty(windowState.id);
  clearNoteWindowFile(windowState.id);
  closeWindow(windowState.id);
}
