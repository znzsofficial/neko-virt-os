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

export function clearNoteWindowState(windowId: string) {
  noteDirtyWindows.delete(windowId);
  noteWindowFiles.delete(windowId);
}

export function clearAllNoteWindowState() {
  noteDirtyWindows.clear();
  noteWindowFiles.clear();
}

export function isNoteWindowDirty(windowId: string) {
  return Boolean(noteDirtyWindows.get(windowId));
}
