import { appConfirm } from "../dialogStore";
import { useLanguageStore } from "../languageStore";
import { clearNoteWindowState, isNoteWindowDirty } from "../notesWindowState";
import { useMmdStudioStore } from "../appModules/mmdStudio/mmdStudioStore";
import type { WindowState } from "../types";

export {
  setNoteWindowDirty,
  setNoteWindowFile,
  getNoteWindowFile,
  clearNoteWindowDirty,
  clearNoteWindowFile,
  clearNoteWindowState,
  clearAllNoteWindowState,
  isNoteWindowDirty,
} from "../notesWindowState";

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
  clearNoteWindowState(windowState.id);
  closeWindow(windowState.id);
}
