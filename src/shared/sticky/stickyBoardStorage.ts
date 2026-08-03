import { setOwnedLocalStorageItem } from "../../system/persistenceGate";

export type StickyNote = { id: string; text: string };

export const STICKY_BOARD_STORAGE_KEY = "neko-virt-os.sticky-board.v1";

export function readStickyNotes(): StickyNote[] {
  try {
    const raw = localStorage.getItem(STICKY_BOARD_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StickyNote[];
    return Array.isArray(parsed) ? parsed.filter((n) => n && typeof n.id === "string") : [];
  } catch {
    return [];
  }
}

export function writeStickyNotes(notes: StickyNote[]) {
  try {
    setOwnedLocalStorageItem(STICKY_BOARD_STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // ignore
  }
}
