import { useLanguageStore } from "./languageStore";
import type { WindowState } from "./types";

export function setNoteWindowDirty(windowId: string, dirty: boolean) {
  const registry = ((globalThis as any).__notes_dirty_windows ??= {}) as Record<string, boolean>;
  registry[windowId] = dirty;
}

export function clearNoteWindowDirty(windowId: string) {
  const registry = ((globalThis as any).__notes_dirty_windows ??= {}) as Record<string, boolean>;
  delete registry[windowId];
}

export function isNoteWindowDirty(windowId: string) {
  const registry = ((globalThis as any).__notes_dirty_windows ?? {}) as Record<string, boolean>;
  return Boolean(registry[windowId]);
}

export function requestCloseWindow(windowState: WindowState, closeWindow: (id: string) => void) {
  const t = useLanguageStore.getState().t;
  if (windowState.appId === "notes" && isNoteWindowDirty(windowState.id)) {
    const shouldClose = window.confirm(t("confirmUnsavedNotes"));
    if (!shouldClose) return;
  }
  clearNoteWindowDirty(windowState.id);
  closeWindow(windowState.id);
}
