import { appConfirm } from "../dialogStore";
import { useLanguageStore } from "../languageStore";
import { useMmdStudioStore } from "../appModules/mmdStudio/mmdStudioStore";
import type { WindowState } from "../types";

const noteDirtyWindows = new Map<string, boolean>();
const noteWindowFiles = new Map<string, string>();

export function setNoteWindowDirty(windowId: string, dirty: boolean) {
  noteDirtyWindows.set(windowId, dirty);
}

export function setNoteWindowFile(windowId: string, fileId: string) {
  noteWindowFiles.set(windowId, fileId);
}

export function getNoteWindowFile(windowId: string) {
  return noteWindowFiles.get(windowId) ?? null;
}

export function clearNoteWindowDirty(windowId: string) {
  noteDirtyWindows.delete(windowId);
}

export function clearNoteWindowFile(windowId: string) {
  noteWindowFiles.delete(windowId);
}

export function isNoteWindowDirty(windowId: string) {
  return Boolean(noteDirtyWindows.get(windowId));
}

function mmdStudioNeedsCloseConfirm() {
  try {
    const state = useMmdStudioStore.getState();
    return state.models.length > 0 || state.recording || state.exportingOffline;
  } catch {
    return true;
  }
}

export async function requestCloseWindow(windowState: WindowState, closeWindow: (id: string) => void) {
  const t = useLanguageStore.getState().t;
  if (windowState.appId === "notes" && isNoteWindowDirty(windowState.id)) {
    const shouldClose = await appConfirm({
      title: t("dialogConfirmTitle"),
      message: t("confirmUnsavedNotes"),
      confirmLabel: t("dialogClose"),
      danger: true,
    });
    if (!shouldClose) return;
  }
  if (windowState.appId === "mmd-studio" && mmdStudioNeedsCloseConfirm()) {
    const shouldClose = await appConfirm({
      title: t("dialogConfirmTitle"),
      message: t("confirmCloseMmdStudio"),
      confirmLabel: t("dialogClose"),
      danger: true,
    });
    if (!shouldClose) return;
  }
  clearNoteWindowDirty(windowState.id);
  clearNoteWindowFile(windowState.id);
  closeWindow(windowState.id);
}
